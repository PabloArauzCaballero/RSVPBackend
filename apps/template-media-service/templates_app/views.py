from django.utils import timezone
from rest_framework.response import Response

from outbox.service import enqueue
from rsvp_template_media.problems import conflict, not_found
from rsvp_template_media.views import ScopedView

from .domain import is_compatible, render_plan, validate_layout, validate_section_order, validate_tags, validate_theme
from .models import Template
from .serializers import RenderPlanInput, TemplateInput, TemplatePatch, serialize_template

PUBLISHED_EVENT = "template.template.published.v1"
ARCHIVED_EVENT = "template.template.archived.v1"


def compatible_templates(templates, event_type_tags: list[str]) -> list[dict]:
    """Only PUBLISHED templates sharing a tag with the event type are offered (REQ-16-01)."""
    return [serialize_template(t) for t in templates if t.status == Template.Status.PUBLISHED and is_compatible(t.event_type_tags, event_type_tags)]


def _tags_param(request) -> list[str]:
    raw = request.query_params.get("eventTypeTags", "")
    return [tag for tag in raw.split(",") if tag]


def _emit(request, template: Template, event_type: str) -> None:
    enqueue(event_type, aggregate_type="Template", aggregate_id=str(template.id), celebration_id=None, payload=template.lifecycle_payload(),
            correlation_id=request.correlation_id, actor_id=request.user.user_id)


class TemplateListView(ScopedView):
    def get(self, request):
        tags = _tags_param(request)
        published = Template.objects.filter(status=Template.Status.PUBLISHED)
        items = compatible_templates(published, tags) if tags else [serialize_template(t) for t in published]
        return Response({"items": items})

    def post(self, request):
        self.require_admin(request)
        data = TemplateInput(data=request.data)
        data.is_valid(raise_exception=True)
        body = data.validated_data
        template = Template.objects.create(
            name=body["name"], description=body.get("description", ""), event_type_tags=validate_tags(body["eventTypeTags"]),
            layout=validate_layout(body["layout"]), theme=validate_theme(body["theme"]), section_order=validate_section_order(body["sectionOrder"]),
        )
        return Response(serialize_template(template), status=201, headers={"Location": f"/media/templates/{template.id}", "ETag": f'"{template.version}"'})


class AdminTemplateListView(ScopedView):
    def get(self, request):
        self.require_admin(request)
        return Response({"items": [serialize_template(t) for t in Template.objects.all()]})


class TemplateDetailView(ScopedView):
    def _load(self, request, template_id) -> Template:
        actor = self.actor_or_none(request)
        template = Template.objects.filter(id=template_id).first()
        if template is None or (template.status != Template.Status.PUBLISHED and not (actor and actor.is_admin)):
            raise not_found("Template")
        return template

    def get(self, request, template_id):
        template = self._load(request, template_id)
        return Response(serialize_template(template), headers={"ETag": f'"{template.version}"', "Cache-Control": "public, max-age=300"})

    def patch(self, request, template_id):
        self.require_admin(request)
        template = Template.objects.select_for_update().filter(id=template_id).first()
        if template is None:
            raise not_found("Template")
        if template.version != self.expected_version(request):
            raise conflict("VERSION_CONFLICT", f"Template is at version {template.version}", currentVersion=template.version)
        if template.status == Template.Status.ARCHIVED:
            raise conflict("TEMPLATE_ARCHIVED", "Archived templates are read-only")
        data = TemplatePatch(data=request.data)
        data.is_valid(raise_exception=True)
        body = data.validated_data
        updates = {
            "name": body.get("name"), "description": body.get("description"),
            "event_type_tags": validate_tags(body["eventTypeTags"]) if "eventTypeTags" in body else None,
            "layout": validate_layout(body["layout"]) if "layout" in body else None,
            "theme": validate_theme(body["theme"]) if "theme" in body else None,
            "section_order": validate_section_order(body["sectionOrder"]) if "sectionOrder" in body else None,
        }
        for field, value in updates.items():
            if value is not None:
                setattr(template, field, value)
        template.version += 1
        template.updated_at = timezone.now()
        template.save()
        if template.status == Template.Status.PUBLISHED:
            _emit(request, template, PUBLISHED_EVENT)
        return Response(serialize_template(template), headers={"ETag": f'"{template.version}"'})


class TemplateTransitionView(ScopedView):
    """POST /templates/<id>/publish and /archive. ARCHIVED is terminal."""

    target: str = ""

    def post(self, request, template_id):
        self.require_admin(request)
        template = Template.objects.select_for_update().filter(id=template_id).first()
        if template is None:
            raise not_found("Template")
        if template.version != self.expected_version(request):
            raise conflict("VERSION_CONFLICT", f"Template is at version {template.version}", currentVersion=template.version)
        allowed = {Template.Status.PUBLISHED: {Template.Status.DRAFT}, Template.Status.ARCHIVED: {Template.Status.DRAFT, Template.Status.PUBLISHED}}
        if template.status not in allowed[self.target]:
            raise conflict("INVALID_TRANSITION", f"Cannot go from {template.status} to {self.target}")
        template.status = self.target
        template.version += 1
        template.updated_at = timezone.now()
        if self.target == Template.Status.PUBLISHED:
            template.published_at = template.updated_at
        template.save()
        _emit(request, template, PUBLISHED_EVENT if self.target == Template.Status.PUBLISHED else ARCHIVED_EVENT)
        return Response(serialize_template(template), headers={"ETag": f'"{template.version}"'})


class PublishTemplateView(TemplateTransitionView):
    target = Template.Status.PUBLISHED


class ArchiveTemplateView(TemplateTransitionView):
    target = Template.Status.ARCHIVED


class RenderPlanView(ScopedView):
    """How this template lays out a celebration: visible and hidden sections, content returned untouched."""

    def post(self, request, template_id):
        template = TemplateDetailView()._load(request, template_id)
        data = RenderPlanInput(data=request.data)
        data.is_valid(raise_exception=True)
        plan = render_plan(list(template.section_order), data.validated_data["enabledSections"], data.validated_data["content"])
        return Response({"templateId": str(template.id), "layout": template.layout, "theme": template.theme, "visible": plan.visible, "hidden": plan.hidden, "content": plan.content})
