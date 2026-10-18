import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rsvp_template_media.settings")
application = get_wsgi_application()
