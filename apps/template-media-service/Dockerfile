# Build from the repository root: docker build -f apps/template-media-service/Dockerfile .
FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DJANGO_SETTINGS_MODULE=rsvp_template_media.settings
WORKDIR /app
COPY apps/template-media-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/template-media-service/ ./
RUN python -m compileall -q rsvp_template_media templates_app media_app outbox && useradd --system --uid 10001 app
USER app
EXPOSE 8002
HEALTHCHECK --interval=10s --timeout=3s --retries=10 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8002/health', timeout=2)"
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_templates && gunicorn rsvp_template_media.wsgi:application --bind 0.0.0.0:8002 --workers 3 --access-logfile -"]
