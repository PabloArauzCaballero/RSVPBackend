from django.http import HttpResponseRedirect
from rest_framework import serializers
from rest_framework.response import Response

from rsvp_template_media.views import ScopedView

from . import services


class PresignInput(serializers.Serializer):
    celebrationId = serializers.UUIDField()
    filename = serializers.CharField(max_length=200)
    contentType = serializers.CharField(max_length=100)
    sizeBytes = serializers.IntegerField()


class OrderInput(serializers.Serializer):
    assetIds = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)
    coverAssetId = serializers.UUIDField(required=False, allow_null=True)


class PresignView(ScopedView):
    def post(self, request):
        actor = self.require_actor(request)
        data = PresignInput(data=request.data)
        data.is_valid(raise_exception=True)
        body = data.validated_data
        return Response(services.issue_upload(actor, str(body["celebrationId"]), body["filename"], body["contentType"], body["sizeBytes"]), status=201)


class CompleteUploadView(ScopedView):
    def post(self, request, asset_id):
        return Response(services.complete_upload(self.require_actor(request), str(asset_id), request.correlation_id))


class CelebrationAssetsView(ScopedView):
    def get(self, request, celebration_id):
        return Response({"items": services.list_assets(self.require_actor(request), str(celebration_id))})


class AssetOrderView(ScopedView):
    def put(self, request, celebration_id):
        actor = self.require_actor(request)
        data = OrderInput(data=request.data)
        data.is_valid(raise_exception=True)
        cover = data.validated_data.get("coverAssetId")
        return Response({"items": services.reorder(actor, str(celebration_id), [str(item) for item in data.validated_data["assetIds"]], str(cover) if cover else None)})


class AssetView(ScopedView):
    def delete(self, request, asset_id):
        services.delete_asset(self.require_actor(request), str(asset_id), request.correlation_id)
        return Response(status=204)


class PublicAssetsView(ScopedView):
    authentication_classes: list = []

    def get(self, request, celebration_id):
        return Response({"items": services.public_assets(str(celebration_id))}, headers={"Cache-Control": "public, max-age=60"})


REDIRECT_CACHE = "public, max-age=600"


class PublicVariantView(ScopedView):
    """GET /public/assets/{id}/{variant} → 302 to a presigned URL valid longer than the cache."""

    authentication_classes: list = []

    def get(self, request, asset_id, variant):
        return HttpResponseRedirect(services.public_variant_redirect(str(asset_id), variant), headers={"Cache-Control": REDIRECT_CACHE})
