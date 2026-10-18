"""RFC 9457 problem responses, the same shape the Node services return."""
from __future__ import annotations

import logging

from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response

PROBLEM_BASE = "https://rsvp.example/problems/"
logger = logging.getLogger("template-media")


class ProblemError(Exception):
    """A domain or request error with its HTTP status, code and extra members."""

    def __init__(self, status_code: int, code: str, title: str, **extra: object) -> None:
        super().__init__(title)
        self.status_code = status_code
        self.code = code
        self.title = title
        self.extra = extra


def not_found(what: str = "Resource") -> ProblemError:
    return ProblemError(status.HTTP_404_NOT_FOUND, "NOT_FOUND", f"{what} not found")


def forbidden(title: str) -> ProblemError:
    return ProblemError(status.HTTP_403_FORBIDDEN, "FORBIDDEN", title)


def conflict(code: str, title: str, **extra: object) -> ProblemError:
    return ProblemError(status.HTTP_409_CONFLICT, code, title, **extra)


def unprocessable(code: str, title: str, **extra: object) -> ProblemError:
    return ProblemError(status.HTTP_422_UNPROCESSABLE_ENTITY, code, title, **extra)


def _body(status_code: int, code: str, title: str, request, **extra: object) -> dict:
    correlation_id = getattr(request, "correlation_id", None) if request is not None else None
    return {"type": f"{PROBLEM_BASE}{code.lower()}", "title": title, "status": status_code, "code": code, "correlationId": correlation_id, **extra}


def exception_handler(exc, context):
    request = context.get("request")
    if isinstance(exc, ProblemError):
        return Response(_body(exc.status_code, exc.code, exc.title, request, **exc.extra), status=exc.status_code, content_type="application/problem+json")
    if isinstance(exc, Http404):
        return Response(_body(404, "NOT_FOUND", "Not found", request), status=404, content_type="application/problem+json")
    if isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        response = Response(_body(401, "UNAUTHORIZED", "A valid bearer token is required", request), status=401, content_type="application/problem+json")
        response["WWW-Authenticate"] = "Bearer"
        return response
    if isinstance(exc, exceptions.ValidationError):
        return Response(_body(400, "BAD_REQUEST", "The request body is not valid", request, issues=exc.detail), status=400, content_type="application/problem+json")
    if isinstance(exc, exceptions.APIException):
        return Response(_body(exc.status_code, exc.default_code.upper(), str(exc.detail), request), status=exc.status_code, content_type="application/problem+json")
    logger.exception("unhandled error", extra={"correlationId": getattr(request, "correlation_id", None)})
    return Response(_body(500, "INTERNAL", "Unexpected error", request), status=500, content_type="application/problem+json")
