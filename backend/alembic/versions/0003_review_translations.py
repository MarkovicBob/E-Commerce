"""localized review comments

Revision ID: 0003_review_translations
Revises: 0002_catalog_extensions
Create Date: 2026-08-30
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_review_translations"
down_revision = "0002_catalog_extensions"
branch_labels = None
depends_on = None

TRANSLATIONS = {
    "Besprekorna izrada.": ("Flawless craftsmanship.", "Makellose Verarbeitung."),
    "Ceka moderaciju.": ("Awaiting moderation.", "Wartet auf Moderation."),
    "Izrada je zaista na nivou, stigla je brzo i upakovano besprekorno.": (
        "The craftsmanship is excellent; it arrived quickly and was impeccably packaged.",
        "Die Verarbeitung ist ausgezeichnet; die Lieferung war schnell und die Verpackung makellos.",
    ),
    "Kvalitet opravdava cenu. Koristim svakodnevno već mesecima.": (
        "The quality justifies the price. I have used it every day for months.",
        "Die Qualität rechtfertigt den Preis. Ich benutze es seit Monaten täglich.",
    ),
    "Vrlo lep komad, jedino je nijansa nešto tamnija nego na slici.": (
        "A beautiful piece; the shade is just a little darker than in the photo.",
        "Ein sehr schönes Stück; der Farbton ist nur etwas dunkler als auf dem Foto.",
    ),
    "Zadovoljan sam, ali isporuka je kasnila dva dana.": (
        "I am satisfied, although delivery was two days late.",
        "Ich bin zufrieden, allerdings kam die Lieferung zwei Tage zu spät.",
    ),
    "Solidno za tu cenu, očekivao sam malo deblji materijal.": (
        "Good for the price, though I expected a slightly heavier material.",
        "Für den Preis solide, allerdings hatte ich etwas dickeres Material erwartet.",
    ),
    "Odlična kupovina, već sam naručila drugi komad.": (
        "An excellent purchase; I have already ordered a second piece.",
        "Ein ausgezeichneter Kauf; ich habe bereits ein zweites Stück bestellt.",
    ),
    "Materijal je prijatan, veličina odgovara tabeli.": (
        "The material feels pleasant and the size matches the chart.",
        "Das Material fühlt sich angenehm an und die Größe entspricht der Tabelle.",
    ),
}


def columns() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if "reviews" not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns("reviews")}


def upgrade() -> None:
    present = columns()
    if not present:
        return
    if "comment_en" not in present:
        op.add_column("reviews", sa.Column("comment_en", sa.Text(), nullable=True))
    if "comment_de" not in present:
        op.add_column("reviews", sa.Column("comment_de", sa.Text(), nullable=True))

    connection = op.get_bind()
    reviews = sa.table(
        "reviews",
        sa.column("comment", sa.Text()),
        sa.column("comment_en", sa.Text()),
        sa.column("comment_de", sa.Text()),
    )
    for comment, (english, german) in TRANSLATIONS.items():
        connection.execute(
            reviews.update()
            .where(reviews.c.comment == comment)
            .values(comment_en=english, comment_de=german)
        )


def downgrade() -> None:
    present = columns()
    if "comment_de" in present:
        op.drop_column("reviews", "comment_de")
    if "comment_en" in present:
        op.drop_column("reviews", "comment_en")
