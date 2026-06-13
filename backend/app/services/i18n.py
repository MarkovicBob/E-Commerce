SUPPORTED_LANGS = {"sr", "en", "de"}


def normalize_lang(lang: str | None) -> str:
    return lang if lang in SUPPORTED_LANGS else "sr"


def localized(entity, lang: str, fields: tuple[str, ...]) -> dict:
    lang = normalize_lang(lang)
    data = {field: getattr(entity, field) for field in fields}
    translations = getattr(entity, "translations", []) or []
    chosen = next((item for item in translations if item.language_code == lang), None)
    if not chosen and lang != "sr":
        chosen = next((item for item in translations if item.language_code == "sr"), None)
    if chosen:
        for field in fields:
            if hasattr(chosen, field):
                data[field] = getattr(chosen, field)
    return data
