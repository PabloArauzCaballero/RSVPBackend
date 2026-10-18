from django.core.management.base import BaseCommand

from outbox.consumers import consume_forever


class Command(BaseCommand):
    help = "Consumes celebration.* events into celebration_access."

    def handle(self, *args, **options):
        consume_forever()
