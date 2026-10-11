from dataclasses import dataclass, field
from enum import StrEnum

class TemplateStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"

@dataclass(slots=True)
class Template:
    id: str
    name: str
    event_type_tags: set[str]
    sections: dict[str, object]
    status: TemplateStatus = TemplateStatus.DRAFT

    def compatible_with(self, event_type_tags: set[str]) -> bool:
        return self.status is TemplateStatus.PUBLISHED and bool(self.event_type_tags & event_type_tags)
