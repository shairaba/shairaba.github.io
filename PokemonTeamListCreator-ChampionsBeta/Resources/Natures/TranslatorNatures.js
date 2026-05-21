var NatureTranslator = {
    // English
    "Hardy": "Hardy", "Docile": "Docile", "Bashful": "Bashful", "Quirky": "Quirky", "Serious": "Serious",
    "Bold": "Bold", "Modest": "Modest", "Calm": "Calm", "Timid": "Timid", "Lonely": "Lonely", "Mild": "Mild",
    "Gentle": "Gentle", "Hasty": "Hasty", "Adamant": "Adamant", "Impish": "Impish", "Careful": "Careful",
    "Jolly": "Jolly", "Naughty": "Naughty", "Lax": "Lax", "Rash": "Rash", "Naive": "Naive", "Brave": "Brave",
    "Relaxed": "Relaxed", "Quiet": "Quiet", "Sassy": "Sassy",

    // Spanish
    "Fuerte": "Hardy", "Dócil": "Docile", "Tímida": "Bashful", "Rara": "Quirky", "Seria": "Serious",
    "Osada": "Bold", "Modesta": "Modest", "Serena": "Calm", "Miedosa": "Timid", "Huraña": "Lonely",
    "Afable": "Mild", "Amable": "Gentle", "Activa": "Hasty", "Firme": "Adamant", "Agitada": "Impish",
    "Cauta": "Careful", "Alegre": "Jolly", "Pícara": "Naughty", "Floja": "Lax", "Alocada": "Rash",
    "Ingenua": "Naive", "Audaz": "Brave", "Plácida": "Relaxed", "Mansa": "Quiet", "Grosera": "Sassy",

    // Italian
    "Ardente": "Hardy", "Ritrosa": "Bashful", "Furba": "Quirky", "Seria": "Serious",
    "Sicura": "Bold", "Modesta": "Modest", "Calma": "Calm", "Timida": "Timid", "Schiva": "Lonely",
    "Mite": "Mild", "Gentile": "Gentle", "Lesta": "Hasty", "Decisa": "Adamant", "Scaltra": "Impish",
    "Cauta": "Careful", "Allegra": "Jolly", "Birbona": "Naughty", "Fiacca": "Lax", "Ardita": "Rash",
    "Ingenua": "Naive", "Audace": "Brave", "Placida": "Relaxed", "Quieta": "Quiet", "Vivace": "Sassy",

    // German
    "Robust": "Hardy", "Sanft": "Docile", "Zaghaft": "Bashful", "Kauzig": "Quirky", "Ernst": "Serious",
    "Kühn": "Bold", "Mäßig": "Modest", "Still": "Calm", "Scheu": "Timid", "Solo": "Lonely",
    "Zart": "Gentle", "Hastig": "Hasty", "Hart": "Adamant", "Pfiffig": "Impish",
    "Sacht": "Careful", "Froh": "Jolly", "Frech": "Naughty", "Lasch": "Lax", "Hitzig": "Rash",
    "Naiv": "Naive", "Mutig": "Brave", "Locker": "Relaxed", "Ruhig": "Quiet", "Forsch": "Sassy",

    // French
    "Hardi": "Hardy", "Pudique": "Bashful", "Bizarre": "Quirky", "Sérieux": "Serious",
    "Assuré": "Bold", "Modeste": "Modest", "Calme": "Calm", "Timide": "Timid",
    "Doux": "Mild", "Gentil": "Gentle", "Pressé": "Hasty", "Rigide": "Adamant", "Malin": "Impish",
    "Prudent": "Careful", "Jovial": "Jolly", "Mauvais": "Naughty", "Lâche": "Lax", "Foufou": "Rash",
    "Naïf": "Naive", "Relax": "Relaxed", "Discret": "Quiet", "Malpoli": "Sassy",

    // Japanese
    "がんばりや": "Hardy", "すなお": "Docile", "てれや": "Bashful", "きまぐれ": "Quirky", "まじめ": "Serious",
    "ずぶとい": "Bold", "ひかえめ": "Modest", "おだやか": "Calm", "おくびょう": "Timid", "さみしがり": "Lonely",
    "おっとり": "Mild", "おとなしい": "Gentle", "せっかち": "Hasty", "いじっぱり": "Adamant", "わんぱく": "Impish",
    "しんちょう": "Careful", "ようき": "Jolly", "やんちゃ": "Naughty", "のうてんき": "Lax", "うっかりや": "Rash",
    "むじゃき": "Naive", "ゆうかん": "Brave", "のんき": "Relaxed", "れいせい": "Quiet", "なまいき": "Sassy",

    // Korean
    "노력": "Hardy", "온순": "Docile", "수줍음": "Bashful", "변덕": "Quirky", "성실": "Serious",
    "대담": "Bold", "조심": "Modest", "차분": "Calm", "겁쟁이": "Timid", "외로움": "Lonely",
    "의젓": "Mild", "얌전": "Gentle", "성급": "Hasty", "고집": "Adamant", "장난꾸러기": "Impish",
    "신중": "Careful", "명랑": "Jolly", "개구쟁이": "Naughty", "촐랑": "Lax", "덜렁": "Rash",
    "천진난만": "Naive", "용감": "Brave", "무사태평": "Relaxed", "냉정": "Quiet", "건방": "Sassy",

    // Chinese (Simplified & Traditional use the same text for Natures mostly, handled together)
    "勤奋": "Hardy", "勤奮": "Hardy", "坦率": "Docile", "腼腆": "Bashful", "靦腆": "Bashful", "浮躁": "Quirky", "认真": "Serious", "認真": "Serious",
    "大胆": "Bold", "大膽": "Bold", "内敛": "Modest", "內斂": "Modest", "温和": "Calm", "溫和": "Calm", "胆小": "Timid", "膽小": "Timid",
    "怕寂寞": "Lonely", "慢吞吞": "Mild", "温顺": "Gentle", "溫順": "Gentle", "急躁": "Hasty", "固执": "Adamant", "固執": "Adamant",
    "淘气": "Impish", "淘氣": "Impish", "慎重": "Careful", "爽朗": "Jolly", "顽皮": "Naughty", "頑皮": "Naughty", "乐天": "Lax", "樂天": "Lax",
    "马虎": "Rash", "馬虎": "Rash", "天真": "Naive", "勇敢": "Brave", "悠闲": "Relaxed", "悠閒": "Relaxed", "冷静": "Quiet", "冷靜": "Quiet", "自大": "Sassy"
};