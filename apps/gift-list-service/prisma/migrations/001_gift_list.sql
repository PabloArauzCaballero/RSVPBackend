CREATE TABLE gift_list (id UUID PRIMARY KEY, celebration_id UUID NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE gift_item (id UUID PRIMARY KEY, list_id UUID NOT NULL REFERENCES gift_list(id), source TEXT NOT NULL, status TEXT NOT NULL, price_minor BIGINT NOT NULL CHECK (price_minor >= 0), currency CHAR(3) NOT NULL, version INTEGER NOT NULL DEFAULT 0);
CREATE TABLE gift_reservation (id UUID PRIMARY KEY, item_id UUID NOT NULL REFERENCES gift_item(id), guest_id UUID NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
-- Production reservation: UPDATE gift_item SET status=$3, version=version+1 WHERE id=$1 AND version=$2 AND status='AVAILABLE';
-- rollback: DROP TABLE gift_reservation; DROP TABLE gift_item; DROP TABLE gift_list;
