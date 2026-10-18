"""Base view: every request runs inside its own transaction with the RLS scope of the caller."""
from django.db import connection
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth import Actor
from .problems import ProblemError, forbidden
from .scope import apply_scope

PRECONDITION_REQUIRED = 428


class ScopedView(APIView):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        apply_scope(self.actor_or_none(request))

    @staticmethod
    def actor_or_none(request) -> Actor | None:
        return request.user if isinstance(request.user, Actor) else None

    def require_actor(self, request) -> Actor:
        actor = self.actor_or_none(request)
        if actor is None:
            from rest_framework.exceptions import NotAuthenticated

            raise NotAuthenticated()
        return actor

    def require_admin(self, request) -> Actor:
        actor = self.require_actor(request)
        if not actor.is_admin:
            raise forbidden("Only platform administrators manage templates")
        return actor

    @staticmethod
    def expected_version(request) -> int:
        header = request.headers.get("If-Match", "").replace("W/", "").strip('"')
        if not header.isdigit():
            raise ProblemError(PRECONDITION_REQUIRED, "PRECONDITION_REQUIRED", "Send If-Match with the version you edited")
        return int(header)


class HealthView(APIView):
    authentication_classes: list = []

    def get(self, request):
        return Response({"status": "ok"})


class ReadyView(APIView):
    authentication_classes: list = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return Response({"status": "ready"})
        except Exception:  # noqa: BLE001 - readiness reports, it does not raise
            return Response({"status": "not-ready"}, status=503)
