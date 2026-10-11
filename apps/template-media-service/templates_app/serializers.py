from .models import Template

def serialize_template(template: Template) -> dict[str, object]:
    return {"id": template.id, "name": template.name, "eventTypeTags": sorted(template.event_type_tags), "sections": template.sections, "status": template.status.value}
