'use strict'

import { Koffing } from './koff.js';

// =========================================================================
// MASTER NATURE TRANSLATOR (Embedded to prevent loading order errors)
// =========================================================================
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
    "Mite": "Mild", "Gentile": "Gentile", "Lesta": "Hasty", "Decisa": "Adamant", "Scaltra": "Impish",
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
    "\u304c\u3093\u3070\u308a\u3084": "Hardy", "\u3059\u306a\u304a": "Docile", "\u3066\u308c\u3084": "Bashful", "\u304d\u307e\u3050\u308c": "Quirky", "\u307e\u3058\u3081": "Serious",
    "\u305a\u3076\u3068\u3044": "Bold", "\u3072\u304b\u3048\u3081": "Modest", "\u304a\u3060\u3084\u304b": "Calm", "\u304a\u304f\u3073\u3087\u3046": "Timid", "\u3055\u307f\u3057\u304c\u308a": "Lonely",
    "\u304a\u306b\u3068\u308a": "Mild", "\u304a\u3068\u306a\u3057\u3044": "Gentle", "\u305b\u3063\u304b\u3061": "Hasty", "\u3044\u3058\u3063\u3071\u308a": "Adamant", "\u308f\u3093\u3071\u304f": "Impish",
    "\u3057\u3093\u3061\u3087\u3046": "Careful", "\u3088\u3046\u304d": "Jolly", "\u3084\u3093\u3061\u3083": "Naughty", "\u306e\u3046\u3066\u3093\u304d": "Lax", "\u3046\u304b\u308a\u3084": "Rash",
    "\u3091\u3058\u3083\u304d": "Naive", "\u3083\u3046\u304b\u3093": "Brave", "\u306e\u3093\u304d": "Relaxed", "\u308c\u3044\u305b\u3044": "Quiet", "\u306a\u307e\u3044\u304d": "Sassy",

    // Korean
    "\ub178\ub825": "Hardy", "\uc628\uc21c": "Docile", "\uc218\uc90d\uc7ac": "Bashful", "\ubca0\ub355": "Quirky", "\uc131\uc2e4": "Serious",
    "\ub300\ub2f4": "Bold", "\uc170\uc2ec": "Modest", "\ucc28\ubd84": "Calm", "\uac81\uc7ac\uc774": "Timid", "\uc678\ub85c\uc6c0": "Lonely",
    "\uc758\uc813": "Mild", "\uc58c\uc804": "Gentle", "\uc131\uae09": "Hasty", "\uace0\uc9d1": "Adamant", "\uc7a5\ub09c\ubf40\ub7ec\uae30": "Impish",
    "\uc2e0\uc911": "Careful", "\uba85\ub791": "Jolly", "\uac1c\uad6c\uc7ac\uc774": "Naughty", "\ucca8\ub791": "Lax", "\ub35c\ub801": "Rash",
    "\ucca1\uc9c4\ub09c\ub9cc": "Naive", "\uc6a9\uac10": "Brave", "\ubbc2\uc0ac\ud0dc\ud3c9": "Relaxed", "\ub0c9\uc815": "Quiet", "\uac74\ubc29": "Sassy",

    // Chinese (Simplified & Traditional)
    "\u52e4\u594b": "Hardy", "\u52e4\u596b": "Hardy", "\u5766\u7387": "Docile", "\u8146\u8147": "Bashful", "\u976c\u977c": "Bashful", "\u6d6e\u8e81": "Quirky", "\u8ba4\u771f": "Serious", "\u8a8d\u771f": "Serious",
    "\u5927\u80c6": "Bold", "\u5927\u81bd": "Bold", "\u5185\u655b": "Modest", "\u5167\u6582": "Modest", "\u6e29\u548c": "Calm", "\u6eab\u548c": "Calm", "\u80c6\u5c0f": "Timid", "\u81bd\u5c0f": "Timid",
    "\u6015\u5bc2\u5bde": "Lonely", "\u6162\u541e\u541e": "Mild", "\u6e29\u987a": "Gentle", "\u6eab\u9806": "Gentle", "\u6025\u8e81": "Hasty", "\u56fa\u6267": "Adamant", "\u56fa\u57f7": "Adamant",
    "\u6dd8\u6c14": "Impish", "\u6dd8\u6c23": "Impish", "\u614e\u91cd": "Careful", "\u723d\u6717": "Jolly", "\u987d\u76ae": "Naughty", "\u9811\u76ae": "Naughty", "\u4e50\u5929": "Lax", "\u6a02\u5929": "Lax",
    "\u9a6c\u864e": "Rash", "\u99ac\u864e": "Rash", "\u5929\u771f": "Naive", "\u52c7\u6562": "Brave", "\u60a0\u95f2": "Relaxed", "\u60a0\u9592": "Relaxed", "\u51b7\u9759": "Quiet", "\u51b7\u975c": "Quiet", "\u81ea\u5927": "Sassy"
};
// =========================================================================

const urlParams = new URLSearchParams(window.location.search);
document.getElementById('playerName').value = urlParams.get('player');
document.getElementById('trainerName').value = urlParams.get('trainer');
document.getElementById('teamName').value = urlParams.get('team');
document.getElementById('switchName').value = urlParams.get('switch');
document.getElementById('playerId').value = urlParams.get('id');
document.getElementById('birth').value = urlParams.get('dob');
if (urlParams.get('age')){
    document.getElementById(urlParams.get('age')).checked = true;
}
if (urlParams.get('lang')){
    document.getElementById(urlParams.get('lang')).checked = true;
}

const langFiles = [
    "./Resources/Pokes/Pokes",
    "./Resources/Abilities/Abilities",
    "./Resources/Items/Items",
    "./Resources/Moves/Moves",
    "./Resources/Types/Types",
    "./Resources/Natures/Natures" // Added Natures Localization
];

const langs = ['Chs', 'Cht', 'En', 'Es', 'Fre', 'Ger', 'Ita', 'Jpn', 'Kor'];

for (let i = 0; i < langs.length; i++) {
    for (let z = 0; z < langFiles.length; z++) {
        var myScript = document.createElement('script');
        myScript.setAttribute('src', langFiles[z] + langs[i] + '.js');
        document.head.appendChild(myScript);
    }
}

const button = document.getElementById('print');
const sheets = document.getElementsByName('sheet');

function getStats(poke, ivs, evs, level, nat) {

    var ret = {'hp': 0, 'atk': 0, 'def': 0, 'spa': 0, 'spd': 0, 'spe': 0};

    var baseStats = pokedex[poke];
    var nature = natures[nat];

    for (const [key, value] of Object.entries(baseStats)){
        if (key == 'hp'){
            var stat = Math.floor(((((2 * baseStats.hp) + (evs.hp/4) + ivs.hp) * level)/100) + level + 10);
            ret['hp'] = stat;
        } else {
            var stat = Math.floor(Math.floor((((((2 * baseStats[key]) + (evs[key]/4) + ivs[key]) * level) / 100) + 5)) * nature[key]);
            ret[key] = stat;
        }
    }

    return ret

}

function sheetChange(event) {

    if (event.target.id == "reg"){
        var langInputs = document.querySelectorAll("#listLang input");
        for (const element of langInputs) {
          element.setAttribute("type", "checkbox");
          element.checked = true;
        }

        var spanTags = document.querySelectorAll('#listLang .dot');
        for (const element of spanTags) {
            element.style.borderRadius  = 0;
        }

        var spanTags = document.querySelectorAll('#listLang .option');
        for (const element of spanTags) {
            element.classList.add("cb");
        }
    } else {
        var langInputs = document.querySelectorAll("#listLang input");
        for (const element of langInputs) {
            element.setAttribute("type", "radio");
        }

        var spanTags = document.querySelectorAll('#listLang .dot');
        for (const element of spanTags) {
            element.style.borderRadius  = "50%";
        }

        var spanTags = document.querySelectorAll('#listLang .option');
        for (const element of spanTags) {
            element.classList.remove("cb");
        }
    }

}



function generatePdf(element) {

    document.getElementById('error').innerText = '';

    var playerName = document.getElementById('playerName').value;
    var trainerName = document.getElementById('trainerName').value;
    var teamName = document.getElementById('teamName').value;
    var switchName = document.getElementById('switchName').value;
    var playerId = document.getElementById('playerId').value;
    var birth = document.getElementById('birth').value;
    var paste = document.getElementById('paste').value;
    var ageDivision = document.querySelector('input[name="ageDivision"]:checked');
    var chosenLang = document.querySelectorAll('input[name="radioLang"]:checked');

    for (var sheet of sheets) {
        if (sheet.checked){
            sheet = sheet.value;
            break;
        }
    }

    if (!sheet){
        document.getElementById('error').innerText = 'NO TEAM LIST SELECTED';
        return
    }
    else if (!paste) {
        document.getElementById('error').innerText = 'NO PASTE DETECTED';
        return
    }
    else if (chosenLang.length === 0){
        document.getElementById('error').innerText = 'NO LANGUAGE SELECTED';
        return
    }




    var parsedTeam = Koffing.parse(paste);

    const doc = new jsPDF();

    if (sheet == 'open' || sheet == 'close'){
        chosenLang = chosenLang[0].value;

        if (chosenLang == 'Cht' || chosenLang == 'Chs') {
            doc.addFileToVFS("customFont.ttf", fontCh);
            doc.addFont('customFont.ttf', 'customFont', 'normal');
            doc.setFont("customFont", 'normal');
        }
        else if (chosenLang == 'Jpn') {
            doc.addFileToVFS("customFont.ttf", fontJpn);
            doc.addFont('customFont.ttf', 'customFont', 'normal');
            doc.setFont("customFont", 'normal');
        }
        else if (chosenLang == 'Kor') {
            doc.addFileToVFS("customFont.ttf", fontKor);
            doc.addFont('customFont.ttf', 'customFont', 'normal');
            doc.setFont("customFont", 'normal');
        }
        else {
            doc.addFileToVFS("customFont.ttf", fontLatin);
            doc.addFont('customFont.ttf', 'customFont', 'normal');
            doc.setFont("customFont", 'normal');
        }

        doc.addFileToVFS("text1.ttf", text1);
        doc.addFont('text1.ttf', 'text1', 'normal');
        doc.addFileToVFS("text2.ttf", text2);
        doc.addFont('text2.ttf', 'text2', 'normal');
        doc.addFileToVFS("text3.ttf", text3);
        doc.addFont('text3.ttf', 'text3', 'normal');

        doc.setFontSize(7);
        doc.setFont("text2", 'normal');
        var msg = "All Pokémon must be listed exactly as they appear in the Battle Team.";
        doc.text(50, 272, msg);

        doc.setFontSize(13);
        doc.setFont("text1", 'normal');
        var msg = "Pokémon Video Game Team List";
        doc.text(73, 12.5, msg);

        doc.setLineWidth(0.3);
        var x = 45;
        var y = 34.5;
        var mygap = 7;
        for (let i = 0; i < 4; i++) {
            doc.line(x, y+mygap*i, x+65, y+mygap*i);
        }

        doc.setFontSize(12);
        doc.setFont("text1", 'normal');

        var msg = "Player Name: ";
        doc.text(45, 33, msg, "right");

        doc.setFontSize(9);

        var msg = "Trainer Name in Game: ";
        doc.text(45, 40, msg, "right");

        var msg = "Battle Team Number / Name: ";
        doc.text(45, 47, msg, "right");

        var msg = "Switch Profile Name: ";
        doc.text(45, 54, msg, "right");

        var x = 155;
        var gapx = 21;
        for (let i = 0; i < 3; i++) {
            doc.rect(x + gapx * i, 30, 4, 4);
        }

        var msg = "Age Division: ";
        doc.text(140, 33, msg, "right");
        var msg = "Juniors ";
        doc.text(154, 33, msg, "right");
        var msg = "Seniors ";
        doc.text(175, 33, msg, "right");
        var msg = "Masters ";
        doc.text(196, 33, msg, "right");

        doc.setFont("text2", 'normal');
        doc.setFontSize(13);
        doc.text(playerName, 47, 33);
        doc.text(trainerName, 47, 40);
        doc.text(teamName, 47, 47);
        doc.text(switchName, 47, 54);

        for (let i = 0; i < 6; i++) {
            doc.setLineWidth(0.6);
            var x = 6.5 + 99 * (i%2);
            var y = 59.5 + 70 * Math.floor(i/2);
            doc.rect(x, y, 95, 68);

            doc.setLineWidth(0.4);
            var startY = 12;
            var mygap = 8;
            for (let b = 0; b < 7; b++) {
                doc.line(x, y+startY+mygap*b, x+95, y+startY+mygap*b);
            }
        }

        if (ageDivision) {
            ageDivision = ageDivision.value;
            doc.setLineWidth(1);
            var posX = 154 + 21 * ageDivision;
            doc.line(posX, 29, posX+6, 35);
            doc.line(posX+6, 29, posX, 35);
        }

        var pokes = parsedTeam.teams[0].pokemon;

        for (let i = 0; i < pokes.length; i++) {

            var textX = 35;
            var statX = 100;
            var gapX = 100;
            var textXX = 27.5;

            var pokeY = 67;
            var natureY = pokeY + 9.5; 
            var abilityY = pokeY + 18;
            var itemY = pokeY + 26;
            var gapY = 70;

            var moveY = pokeY + 34;
            var moveGapY = 8;

            var statY = pokeY + 19.5; 
            var statGapY = 8;

            var nameId = PokeTranslator[pokes[i].name];
            var abilityId = AbilityTranslator[pokes[i].ability];

            var itemId = 'NOITEM';
            if (pokes[i].item){
                itemId = ItemTranslator[pokes[i].item];
            }

            var natureBaseId = 'Serious';
            if (pokes[i].nature) {
                natureBaseId = NatureTranslator[pokes[i].nature] || pokes[i].nature;
            }

            var level = 50; // Forced to 50 for math calculation
            if (pokes[i].level){
                level = pokes[i].level;
            }

            var ivs = {'hp': 31, 'atk': 31, 'def': 31, 'spa': 31, 'spd': 31, 'spe': 31};
            if (pokes[i].ivs) {
                for (const [key, value] of Object.entries(pokes[i].ivs)){
                    ivs[key] = value;
                }
            }

            var evs = {'hp': 0, 'atk': 0, 'def': 0, 'spa': 0, 'spd': 0, 'spe': 0};
            if (pokes[i].evs){
                for (const [key, value] of Object.entries(pokes[i].evs)){
                    evs[key] = value;
                }
            }

            if (!pokedex[pokes[i].name]){
                document.getElementById('error').innerText = 'ERROR IN PASTE';
                return;
            }

            var name = window['pokes' + chosenLang][nameId];
            
            // Check for localized nature, fallback to english nature if not found
            var printedNature = natureBaseId;
            if (window['natures' + chosenLang] && window['natures' + chosenLang][natureBaseId]) {
                printedNature = window['natures' + chosenLang][natureBaseId];
            }

            var ability = window['abilities' + chosenLang][abilityId];
            var item = 'NO ITEM';
            if (itemId != 'NOITEM'){
                item = window['items' + chosenLang][itemId];
            }
            var movs = [];
            for (let x = 0; x < pokes[i].moves.length; x++){
                var moveId = MoveTranslator[pokes[i].moves[x]];
                movs.push(window['moves' + chosenLang][moveId]);
            }

            doc.setFontSize(13);
            doc.setFont("text1", 'normal');
            doc.text("Pokémon", textXX + (i%2) * gapX, pokeY + (Math.floor(i/2)) * gapY, "right");
            doc.setFontSize(12);
            doc.setFont("customFont", 'normal');
            doc.text(name, textX + (i%2) * gapX, pokeY + (Math.floor(i/2)) * gapY);

            // ================== FIXED STAT ALIGNMENT FONT SCALING ==================
            var statAlignmentLabel = "Stat Alignment";
            var alignmentFontSize = 13; // Start at default label size
            doc.setFont("text1", 'normal');
            doc.setFontSize(alignmentFontSize);

            var scaleFactor = doc.internal.scaleFactor || 2.83464;
            var alignmentTextWidth = (doc.getStringUnitWidth(statAlignmentLabel) * alignmentFontSize) / scaleFactor;
            var maxAlignmentWidth = 19.5; // Strict limit to keep it away from the left border (6.5)

            while (alignmentTextWidth > maxAlignmentWidth && alignmentFontSize > 5) {
                alignmentFontSize -= 0.5;
                doc.setFontSize(alignmentFontSize);
                alignmentTextWidth = (doc.getStringUnitWidth(statAlignmentLabel) * alignmentFontSize) / scaleFactor;
            }

            doc.text(statAlignmentLabel, textXX + (i%2) * gapX, natureY + (Math.floor(i/2)) * gapY, "right");
            // =========================================================================

            doc.setFontSize(11);
            doc.setFont("customFont", 'normal');
            doc.text(printedNature, textX + (i%2) * gapX, natureY + (Math.floor(i/2)) * gapY);

            doc.setFontSize(13);
            doc.setFont("text1", 'normal');
            doc.text("Ability", textXX + (i%2) * gapX, abilityY + (Math.floor(i/2)) * gapY, "right");
            doc.setFontSize(11);
            doc.setFont("customFont", 'normal');
            doc.text(ability, textX + (i%2) * gapX, abilityY + (Math.floor(i/2)) * gapY);

            doc.setFontSize(13);
            doc.setFont("text1", 'normal');
            doc.text("Held Item", textXX + (i%2) * gapX, itemY + (Math.floor(i/2)) * gapY, "right");
            doc.setFontSize(11);
            doc.setFont("customFont", 'normal');
            doc.text(item, textX + (i%2) * gapX, itemY + (Math.floor(i/2)) * gapY);

            for (let j = 0; j < movs.length; j++) {
                doc.setFontSize(13);
                doc.setFont("text1", 'normal');
                doc.text("Move " + (j+1), textXX + (i%2) * gapX, moveY + (Math.floor(i/2)) * gapY + j * moveGapY, "right");
                doc.setFontSize(11);
                doc.setFont("customFont", 'normal');
                doc.text(movs[j], textX + (i%2) * gapX, moveY + (Math.floor(i/2)) * gapY + j * moveGapY);
            }
            
            if (sheet == "close") {
                var stats = getStats(pokes[i].name, ivs, evs, level, natureBaseId);
                
                // Force font to be large and legible for the final numbers
                doc.setFontSize(11);
                doc.setFont("customFont", 'normal');
    
                var j = 0;
                for (const [key, value] of Object.entries(stats)){
                    doc.text(value.toString(), statX + (i%2) * (gapX-1), statY + (Math.floor(i/2)) * gapY + j * statGapY, 'right');
                    j = j + 1;
                }
            }
        }
    }

    if (sheet == 'open') {
        doc.setFontSize(13);
        doc.setFont("text1", 'normal');
        var msg = "2 of 2: ";
        doc.text(83, 18, msg);

        doc.setFont("text3", 'normal');
        var msg = "For Opponents";
        doc.text(96, 18, msg);

        doc.setFontSize(10);
        doc.setFont("text3", 'normal');
        var msg = "Do not lose this page! Keep it throughout the tournament, sharing it with your opponent each round.";
        doc.text(31, 24, msg);

        doc.save(playerId+"-OTS.pdf");

    }

    if (sheet == 'close') {
        doc.setFontSize(13);
        doc.setFont("text1", 'normal');
        var msg = "1 of 2: ";
        doc.text(77, 18, msg);

        doc.setFont("text3", 'normal');
        var msg = "For Tournament Staff";
        doc.text(90, 18, msg);

        doc.setFontSize(10);
        doc.setFont("text3", 'normal');
        var msg = "Complete both pages of this document. Submit this page to event staff before the tournament, at the time set by the Organizer.";
        doc.text(12, 24, msg);

        doc.setLineWidth(0.3);
        doc.setFontSize(9);
        doc.setFont("text1", 'normal');
        var msg = "Player ID: ";
        doc.text(140, 43, msg, "right");
        doc.line(140, 44.5, 180, 44.5);
        doc.setFontSize(13);
        doc.setFont("text2", 'normal');
        doc.text(playerId, 142, 43);

        doc.setFontSize(9);
        doc.setFont("text1", 'normal');
        var msg = "Date of Birth: ";
        doc.text(140, 51, msg, "right");
        doc.line(140, 52.5, 180, 52.5);
        doc.setFontSize(13);
        doc.setFont("text2", 'normal');
        doc.text(birth, 142, 51);


        for (let i = 0; i < 6; i++) {
            doc.setLineWidth(0.4);
            var x = 6.5 + 99 * (i%2);
            var y = 59.5 + 70 * Math.floor(i/2);

            // Left the vertical line drawn exactly beside the 6 remaining boxes
            doc.line(x+80, y+20, x+80, y+68); 
            
            // Shrunk font and perfectly tucked into top-left corner
            doc.setFontSize(5.5); 
            doc.setFont("text1", 'normal');
            
            doc.text(x+81, y+22.5, "HP");
            doc.text(x+81, y+30.5, "Atk");
            doc.text(x+81, y+38.5, "Def");
            doc.text(x+81, y+46.5, "Sp. Atk");
            doc.text(x+81, y+54.5, "Sp. Def");
            doc.text(x+81, y+62.5, "Speed");
        }

        doc.setFontSize(11);
        doc.setFont("customFont", 'normal');


        doc.save(playerId+"-staff.pdf");

    }

    if (sheet == 'reg') {

        var pokes = parsedTeam.teams[0].pokemon;
        doc.addFileToVFS("customFont.ttf", fontLatin);
        doc.addFont('customFont.ttf', 'customFont', 'normal');
        doc.setFont("customFont", 'normal');

        doc.addFileToVFS("customFont.ttf", fontJpn);
        doc.addFont('customFont.ttf', 'customFont', 'normal');
        doc.setFont("customFont", 'normal');

        doc.addFileToVFS("customFont.ttf", fontKor);
        doc.addFont('customFont.ttf', 'customFont', 'normal');
        doc.setFont("customFont", 'normal');
        
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 100, 100);
        const line = canvas.toDataURL();

        doc.setFontSize(14);
        doc.text(playerName+" - "+trainerName, 20, 8, 'left');
        doc.text(ageDivision.id, 199, 11, 'right');

        let c_width=190/7;
        const ygap=3.8;
        const ystart_l=15;
        
        var langValues= [];
        for (let i = 0; i < chosenLang.length; i++) {
         langValues.push(chosenLang[i].value);
        }
        var langcheck = ["En","Fre","Ita","Ger","Es","Jpn","Kor","Chs","Cht"];

        
        for (let r = 0; r < langcheck.length; r++) {
            if (langValues.includes(langcheck[r])) {
                doc.setFillColor('#D3D3D3');
                doc.rect(9,ystart_l+ygap*(8*r),190,ygap,"F");
                doc.setFillColor('#F0F0F0');
                for (let l = 1; l < 4; l++) {
                    doc.rect(9,ystart_l+ygap*(8*r+2*l),190,ygap,"F");
                }
                
            }
        }

        doc.setFillColor('#000000');
        for (let j=0;j<9;j++) {

            
            doc.addImage({imageData:line, format:'png', x:9, y:ystart_l+j*8*ygap, width:190, height:0.3});

            for (let i=0;i<7;i++) {
                doc.addImage({imageData:line, format:'png', x:9, y:ystart_l+(i+1)*ygap+j*8*ygap, width:190, height:0.1});
            }
        }
        doc.addImage({imageData:line, format:'png', x:9, y:ystart_l+72*ygap, width:190, height:0.4});
        for (let i=0;i<8;i++) {
            doc.addImage({imageData:line, format:'png', x:9+c_width*i, y:15, width:0.1, height:273.6});
        }

        // GUI Stat Alignment Update for the Registration Page
        const gui = {
            "En": {
                "item": " Held Item",
                "ability": "Ability",
                "nature": "Stat Alignment",
                "lg":"EN",
                "move":"Move"
            },
            "Es": {
                "item": "Objeto equipado",
                "ability": "Habilidad",
                "nature": "Alineac. Estad.",
                "lg":"ES",
                "move":"Movimento"
            },
            "Ita": {
                "item": "Strumento tenuto",
                "ability": "Abilit\u00e0",
                "nature": "Allineam. Stat.",
                "lg":"IT",
                "move":"Mossa"
            },
            "Ger": {
                "item": "Getragenes Item",
                "ability": "F\u00e4higkeit",
                "nature": "Werteausrichtung",
                "lg":"DE",
                "move":"Attacke"
            },
            "Fre": {
                "item": "Objet tenu",
                "ability": "Talent",
                "nature": "Alignement Stats",
                "lg":"FR",
                "move":"Capacit\u00e9"
            },
            "Jpn":{
                "item":"\u3082\u3061\u3082\u306e",
                "ability": "\u9053\u5177",
                "nature":"\u30b9\u30c6\u30fc\u30bf\u30b9\u88dc\u6b63", 
                "lg":"JP",
                "move":"\u30ef\u30b6"
            },
            "Kor":{
                "item": "\uc544\uc774\ud15c",
                "ability": "\ud2b9\uc131",
                "nature": "\ub2a5\ub825\uce58 \ubcf4\uc815", 
                "lg":"KO",
                "move":"\uae00\uc218"
            },
            "Chs":{
                "item": "\u6301\u6709\u7269\u54c1",
                "ability": "\u80fd\u529b",
                "nature": "\u80fd\u529b\u503c\u53d6\u5411", 
                "lg":"SC",
                "move":"\u52a8\u4f5c" 
            },
            "Cht":{
                "item": "\u6301\u6709\u7269\u54c1",
                "ability": "\u80fd\u529b",
                "nature": "\u80fd\u529b\u503c\u53d6\u5411", 
                "lg":"TC",
                "move":"\u52d5\u4f5c"
            }
        }

        for (let u = 0; u < langcheck.length; u++) {
            
            var currentLang = langcheck[u];
 
            if (langValues.includes(currentLang)) {
    
                if (currentLang == "Chs" || currentLang == "Cht" || currentLang == "Jpn") {
                    doc.addFileToVFS("customFont.ttf", fontCh);
                    doc.addFont('customFont.ttf', 'customFont', 'normal');
                    doc.setFont("customFont", 'normal');
                }
                else if (currentLang == "Kor") {
                    doc.addFileToVFS("customFont.ttf", fontKor);
                    doc.addFont('customFont.ttf', 'customFont', 'normal');
                    doc.setFont("customFont", 'normal');
                }
             
                
                const ystart=18.1;
                var startFontSize=9;
                if (u>=5) {
                    startFontSize=8.5;
                }

                doc.setFontSize(startFontSize);
                doc.setFont("customFont","bold")
                doc.text(gui[currentLang]["lg"], 10, ystart+ygap*8*u, 'left');
                doc.setFont("customFont","normal")
                doc.text("Pok\u00e9mon", 24, ystart+ygap*8*u, 'center');
                doc.text(gui[currentLang]["nature"], 22, ystart+ygap+ygap*8*u, 'center');
                doc.text(gui[currentLang]["ability"], 22, ystart+ygap*2+ygap*8*u, 'center');
                doc.setFontSize(9);
                doc.text(gui[currentLang]['item'], 22, ystart+ygap*3+ygap*8*u,"center");
                doc.setFontSize(startFontSize);
                doc.text(gui[currentLang]['move']+" 1", 22, ystart+ygap*4+ygap*8*u,"center");
                doc.text(gui[currentLang]['move']+" 2", 22, ystart+ygap*5+ygap*8*u,"center");
                doc.text(gui[currentLang]['move']+" 3", 22, ystart+ygap*6+ygap*8*u,"center");
                doc.text(gui[currentLang]['move']+" 4", 22, ystart+ygap*7+ygap*8*u,"center");
                doc.setFont("customFont", 'normal');

                
                for (let i = 0; i < pokes.length; i++) {
                    var id = PokeTranslator[pokes[i].name];
                    var pokeFontSize=startFontSize;
                    var pokeTextWidth= doc.getStringUnitWidth(window['pokes' + currentLang][id])*pokeFontSize;
                    var limitTextWidth=72;
                    if (u>=5) {
                        limitTextWidth=70;
                    }
                    while (pokeTextWidth>limitTextWidth) {
                        pokeFontSize-=0.5;
                        doc.setFontSize(pokeFontSize);
                        pokeTextWidth= doc.getStringUnitWidth(window['pokes' + currentLang][id])*pokeFontSize;
                    }
                    if (u<5) {
                        doc.text(window['pokes' + currentLang][id], 22+c_width*(i+1), ystart+8*ygap*u,"center");
                    } else {
                        doc.text(window['pokes' + currentLang][id], 22+c_width*(i+1), ystart+0.4+8*ygap*u,"center");
                    }
                    doc.setFontSize(startFontSize);

                    var natIdBase = pokes[i].nature || 'Serious';
                    var translatedNature = natIdBase;
                    if (window['natures' + currentLang] && window['natures' + currentLang][natIdBase]) {
                        translatedNature = window['natures' + currentLang][natIdBase];
                    }
                    doc.text(translatedNature, 22+c_width*(i+1), ystart+ygap+8*ygap*u,"center");

                    id = AbilityTranslator[pokes[i].ability];
                    var abilityFontSize=startFontSize;
                    var abilityTextWidth= doc.getStringUnitWidth(window['abilities' + currentLang][id])*abilityFontSize;
                    while (abilityTextWidth>limitTextWidth) {
                        abilityFontSize-=0.5;
                        doc.setFontSize(abilityFontSize);
                        abilityTextWidth= doc.getStringUnitWidth(window['abilities' + currentLang][id])*abilityFontSize;
                    }
                    doc.text(window['abilities' + currentLang][id], 22+c_width*(i+1), ystart+2*ygap+8*ygap*u,"center");
                    doc.setFontSize(startFontSize);
                    id = ItemTranslator[pokes[i].item];
                    var itemFontSize=startFontSize;
                    var itemTextWidth= doc.getStringUnitWidth(window['items' + currentLang][id])*itemFontSize;
                    while (itemTextWidth>limitTextWidth) {
                        itemFontSize-=0.5;
                        doc.setFontSize(itemFontSize);
                        itemTextWidth= doc.getStringUnitWidth(window['items' + currentLang][id])*itemFontSize;
                    }
                    doc.text(window['items' + currentLang][id], 22+c_width*(i+1), ystart+3*ygap+8*ygap*u,"center");
                    doc.setFontSize(startFontSize);
                    for (let x = 0; x < pokes[i].moves.length; x++){
                        var moveId = MoveTranslator[pokes[i].moves[x]];
                        var moveFontSize=startFontSize;
                        var moveTextWidth= doc.getStringUnitWidth(window['moves' + currentLang][moveId])*moveFontSize;
                        while (moveTextWidth>limitTextWidth) {
                            moveFontSize-=0.5;
                            doc.setFontSize(moveFontSize);
                            moveTextWidth= doc.getStringUnitWidth(window['moves' + currentLang][moveId])*moveFontSize;
                        }
                        doc.text(window['moves' + currentLang][moveId], 22+c_width*(i+1), ystart+4*ygap+30.4*u+ygap*x,"center");
                        doc.setFontSize(startFontSize);
                    }
    
                }
            }
        }


        doc.save(playerId+"-reg.pdf");
    }

}

button.addEventListener('click', generatePdf);
for (const element of sheets) {
    element.addEventListener('change', sheetChange);
}

document.getElementById("open").checked = true;
window.generatePdf = generatePdf;
window.jsPDF = window.jspdf.jsPDF;
