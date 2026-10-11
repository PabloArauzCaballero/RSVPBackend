from .models import Template
from .serializers import serialize_template

def compatible_templates(templates: list[Template], event_type_tags: set[str]) -> list[dict[str, object]]:
    return [serialize_template(template) for template in templates if template.compatible_with(event_type_tags)]
