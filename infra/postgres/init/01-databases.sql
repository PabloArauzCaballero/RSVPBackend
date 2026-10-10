CREATE ROLE identity_owner LOGIN PASSWORD 'local-identity-password';
CREATE ROLE celebration_owner LOGIN PASSWORD 'local-celebration-password';
CREATE ROLE guest_owner LOGIN PASSWORD 'local-guest-password';
CREATE ROLE notification_owner LOGIN PASSWORD 'local-notification-password';
CREATE ROLE gift_owner LOGIN PASSWORD 'local-gift-password';
CREATE ROLE provider_owner LOGIN PASSWORD 'local-provider-password';
CREATE ROLE template_owner LOGIN PASSWORD 'local-template-password';

CREATE DATABASE identity_db OWNER identity_owner;
CREATE DATABASE celebration_db OWNER celebration_owner;
CREATE DATABASE guest_db OWNER guest_owner;
CREATE DATABASE notification_db OWNER notification_owner;
CREATE DATABASE gift_db OWNER gift_owner;
CREATE DATABASE provider_db OWNER provider_owner;
CREATE DATABASE template_db OWNER template_owner;

