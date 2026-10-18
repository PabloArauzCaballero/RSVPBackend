from rest_framework import serializers

from .domain import SECTIONS
from .models import Template


def serialize_template(template: Template) -> dict:
    return {
        "id": str(template.id),
        "name": template.name,
        "description": template.description,
        "status": template.status,
        "eventTypeTags": list(template.event_type_tags),
        "layout": template.layout,
        "theme": template.theme,
        "sectionOrder": list(template.section_order),
        "version": template.version,
        "publishedAt": template.published_at.isoformat().replace("+00:00", "Z") if template.published_at else None,
    }


class TemplateInput(serializers.Serializer):
    """Shape only (400); the domain checks the rules (422)."""

    name = serializers.CharField(max_length=120)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    eventTypeTags = serializers.ListField(child=serializers.CharField(max_length=40), allow_empty=False)
    layout = serializers.CharField(max_length=40)
    theme = serializers.DictField()
    sectionOrder = serializers.ListField(child=serializers.CharField(max_length=40), allow_empty=False)

    def validate(self, attrs):
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({key: "Unknown field" for key in sorted(unknown)})
        return attrs


class TemplatePatch(TemplateInput):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, partial=True, **kwargs)


class RenderPlanInput(serializers.Serializer):
    enabledSections = serializers.ListField(child=serializers.ChoiceField(choices=SECTIONS))
    content = serializers.DictField()
