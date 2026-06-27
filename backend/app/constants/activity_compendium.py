"""Default Russian labels for Compendium major headings (2024 Adult Compendium)."""

DEFAULT_MAJOR_HEADING_LABELS: dict[str, str] = {
    "Bicycling": "Велосипед",
    "Conditioning Exercise": "Оздоровительные упражнения",
    "Dancing": "Танцы",
    "Fishing & Hunting": "Рыбалка и охота",
    "Home Activities": "Домашние дела",
    "Home Repair": "Ремонт дома",
    "Inactivity": "Бездействие",
    "Lawn & Garden": "Газон и сад",
    "Miscellaneous": "Разное",
    "Music Playing": "Игра на инструментах",
    "Occupation": "Профессиональная деятельность",
    "Religious Activities": "Религиозная деятельность",
    "Running": "Бег",
    "Self Care": "Уход за собой",
    "Sexual Activity": "Сексуальная активность",
    "Sports": "Спорт",
    "Transportation": "Транспорт",
    "Video Games": "Видеоигры",
    "Volunteer Activities": "Волонтёрство",
    "Walking": "Ходьба",
    "Water Activities": "Водные активности",
    "Winter Activities": "Зимние активности",
}

MANUAL_COMPENDIUM_CODE_PREFIX = "02"
MANUAL_COMPENDIUM_CODE_SEQ_WIDTH = 4
MANUAL_COMPENDIUM_CODE_MAX_SEQ = 10**MANUAL_COMPENDIUM_CODE_SEQ_WIDTH - 1
