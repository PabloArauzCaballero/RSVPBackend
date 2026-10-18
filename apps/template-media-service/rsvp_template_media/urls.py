"""Kong strips the /media prefix (strip_path: true), so these paths are what the service sees."""
from django.urls import path

from media_app import views as media
from templates_app import views as templates

from .views import HealthView, ReadyView

urlpatterns = [
    path("health", HealthView.as_view()),
    path("ready", ReadyView.as_view()),
    path("templates", templates.TemplateListView.as_view()),
    path("admin/templates", templates.AdminTemplateListView.as_view()),
    path("templates/<uuid:template_id>", templates.TemplateDetailView.as_view()),
    path("templates/<uuid:template_id>/publish", templates.PublishTemplateView.as_view()),
    path("templates/<uuid:template_id>/archive", templates.ArchiveTemplateView.as_view()),
    path("templates/<uuid:template_id>/render-plan", templates.RenderPlanView.as_view()),
    path("uploads/presign", media.PresignView.as_view()),
    path("uploads/<uuid:asset_id>/complete", media.CompleteUploadView.as_view()),
    path("assets/<uuid:asset_id>", media.AssetView.as_view()),
    path("celebrations/<uuid:celebration_id>/assets", media.CelebrationAssetsView.as_view()),
    path("celebrations/<uuid:celebration_id>/assets/order", media.AssetOrderView.as_view()),
    path("public/celebrations/<uuid:celebration_id>/assets", media.PublicAssetsView.as_view()),
    path("public/assets/<uuid:asset_id>/<str:variant>", media.PublicVariantView.as_view()),
]
