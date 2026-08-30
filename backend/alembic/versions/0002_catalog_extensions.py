"""catalog extensions: category ordering, product merchandising fields, order shipping details

Revision ID: 0002_catalog_extensions
Revises: 0001_initial
Create Date: 2026-08-29

Migration 0001 creates the schema from the model metadata, so a database created
after these columns were added already has them. This revision brings databases
that were created against the earlier models up to the same shape, and skips any
column that is already present.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0002_catalog_extensions"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

JSON_TYPE = sa.JSON().with_variant(JSONB, "postgresql")

# (table, column, type, kwargs)
NEW_COLUMNS = [
    ("addresses", "label", sa.String(80), {"nullable": True}),
    ("categories", "description", sa.Text(), {"nullable": True}),
    ("categories", "position", sa.Integer(), {"nullable": False, "server_default": "0"}),
    ("category_translations", "description", sa.Text(), {"nullable": True}),
    ("products", "review_count", sa.Integer(), {"nullable": False, "server_default": "0"}),
    ("products", "sales_count", sa.Integer(), {"nullable": False, "server_default": "0"}),
    ("products", "is_featured", sa.Boolean(), {"nullable": False, "server_default": sa.false()}),
    ("products", "specs", JSON_TYPE, {"nullable": True}),
    ("orders", "shipping_method", sa.String(50), {"nullable": False, "server_default": "standard"}),
    ("orders", "contact_email", sa.String(255), {"nullable": True}),
]


def existing_columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if table not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table)}


def upgrade() -> None:
    cache: dict[str, set[str]] = {}
    added: set[tuple[str, str]] = set()
    for table, column, type_, kwargs in NEW_COLUMNS:
        present = cache.setdefault(table, existing_columns(table))
        # An empty set means the table itself is absent, which only happens on a
        # database that never ran 0001; nothing to migrate there.
        if not present or column in present:
            continue
        op.add_column(table, sa.Column(column, type_, **kwargs))
        added.add((table, column))
    if ("orders", "contact_email") in added:
        op.create_index("ix_orders_contact_email", "orders", ["contact_email"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "orders" in inspector.get_table_names():
        indexes = {index["name"] for index in inspector.get_indexes("orders")}
        if "ix_orders_contact_email" in indexes:
            op.drop_index("ix_orders_contact_email", table_name="orders")
    for table, column, _type, _kwargs in reversed(NEW_COLUMNS):
        if table in inspector.get_table_names() and column in existing_columns(table):
            op.drop_column(table, column)
