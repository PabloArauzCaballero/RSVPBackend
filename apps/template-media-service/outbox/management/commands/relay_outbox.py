import logging
import time

from django.core.management.base import BaseCommand

from outbox.relay import PikaPublisher, relay_batch

logger = logging.getLogger("template-media.outbox")
RECONNECT_SECONDS = 5


class Command(BaseCommand):
    help = "Publishes pending outbox events to RabbitMQ (template-media.events), forever or once."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--interval", type=float, default=0.5)

    def handle(self, *args, **options):
        import pika.exceptions

        while True:
            publisher = PikaPublisher()
            try:
                while True:
                    result = relay_batch(publisher)
                    if options["once"]:
                        self.stdout.write(str(result))
                        return
                    publisher.sleep(options["interval"])
            except pika.exceptions.AMQPError as error:
                # Events stay PENDING in the outbox; they are published once the broker is back.
                logger.warning("broker connection lost, reconnecting", extra={"error": str(error)})
                time.sleep(RECONNECT_SECONDS)
            finally:
                publisher.close()
