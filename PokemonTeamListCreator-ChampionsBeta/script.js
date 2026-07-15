'use strict'

import { Koffing } from './koff.js';
import { processImages, renderPokepaste } from './client-ocr/pipeline.mjs';
import { loadResourceBundle } from './client-ocr/loadResources.mjs';

// NatureTranslator (native nature name -> English) is loaded from
// Resources/Natures/TranslatorNatures.js via index.html, same convention as
// PokeTranslator/AbilityTranslator/ItemTranslator/MoveTranslator.

// Light/dark toggle. The initial theme is already applied to <html> by an
// inline blocking script in index.html's <head> (reads the same cookie,
// before first paint) - see that script for why this can't be the only
// place the theme gets applied. The switch's sun/moon icons and knob
// position are driven entirely by CSS off the [data-theme] attribute (see
// style.css), so this only needs to flip that attribute and re-save the
// cookie on click.
const themeToggleBtn = document.getElementById('theme-toggle');

function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

themeToggleBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.cookie = `theme=${next}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
});

const copyPasteBtn = document.getElementById('copy-paste-btn');
copyPasteBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(document.getElementById('paste').value);
    const original = copyPasteBtn.textContent;
    copyPasteBtn.textContent = 'Copied!';
    setTimeout(() => { copyPasteBtn.textContent = original; }, 1200);
});

const urlParams = new URLSearchParams(window.location.search);
document.getElementById('playerName').value = urlParams.get('player');
document.getElementById('trainerName').value = urlParams.get('trainer');
document.getElementById('teamName').value = urlParams.get('team');
document.getElementById('switchName').value = urlParams.get('switch');
document.getElementById('playerId').value = urlParams.get('id');
document.getElementById('birth').value = urlParams.get('dob');
document.getElementById('supportId').value = urlParams.get('support');
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

// Master Translation Helper: Prevents crashes on missing translation IDs
function getTranslation(category, lang, id, fallback) {
    var dict = window[category + lang];
    if (dict && dict[id] !== undefined) {
        return dict[id];
    }
    return fallback || "";
}

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



// Small set of decorative symbols (stars, suits, gender signs, etc.) that the
// main text fonts (Calibri-based text1/text2/text3) don't include. These are
// covered by a separate embedded font ("fontSymbols") and are drawn as their
// own run so a player-typed name like "★ Team ★" doesn't silently lose the stars.
const SYMBOL_CHARS = new Set(['★', '☆', '♥', '❤', '♦', '♣', '♠', '☀', '☾', '♪', '♫', '✓', '✔', '✗', '⚡', '♂', '♀']);

// Draws left-aligned text that may mix "normal" characters (rendered with
// baseFont) and symbol characters (rendered with the fontSymbols font),
// switching fonts per contiguous run so both sets render correctly side by side.
function drawMixedFontText(doc, text, x, y, baseFont, fontSize) {
    if (!text) return;

    doc.setFontSize(fontSize);

    var cursorX = x;
    var currentRun = '';
    var currentIsSymbol = null;

    function flush() {
        if (!currentRun) return;
        doc.setFont(currentIsSymbol ? 'fontSymbols' : baseFont, 'normal');
        doc.text(currentRun, cursorX, y);
        cursorX += doc.getTextWidth(currentRun);
        currentRun = '';
    }

    for (const ch of text) {
        const isSymbol = SYMBOL_CHARS.has(ch);
        if (currentIsSymbol !== null && isSymbol !== currentIsSymbol) {
            flush();
        }
        currentRun += ch;
        currentIsSymbol = isSymbol;
    }
    flush();

    doc.setFont(baseFont, 'normal');
}

function generatePdf(element) {

    document.getElementById('error').innerText = '';

    var playerName = document.getElementById('playerName').value;
    var trainerName = document.getElementById('trainerName').value;
    var teamName = document.getElementById('teamName').value;
    var switchName = document.getElementById('switchName').value;
    var playerId = document.getElementById('playerId').value;
    var birth = document.getElementById('birth').value;
    var supportId = document.getElementById('supportId').value;
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

    // SANITIZE PASTE: Strip out invisible mobile word-joiner characters (\u2060, \u200B, etc.)
    var cleanPaste = paste.replace(/[\u200B-\u200D\uFEFF\u2060]/g, "");

    var parsedTeam = Koffing.parse(cleanPaste);

    var megaMon = parsedTeam.teams[0].pokemon.find(function (poke) {
        return poke.name.indexOf('-Mega') !== -1;
    });
    if (megaMon) {
        document.getElementById('error').innerText = 'MEGA EVOLVED FORMS (' + megaMon.name + ') CANNOT BE LISTED ON A TEAMSHEET. LIST THE BASE SPECIES INSTEAD.';
        return;
    }

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
        doc.addFileToVFS("fontSymbols.ttf", fontSymbols);
        doc.addFont('fontSymbols.ttf', 'fontSymbols', 'normal');

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

        drawMixedFontText(doc, playerName, 47, 33, 'text2', 13);
        drawMixedFontText(doc, trainerName, 47, 40, 'text2', 13);
        drawMixedFontText(doc, teamName, 47, 47, 'text2', 13);
        drawMixedFontText(doc, switchName, 47, 54, 'text2', 13);

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

            var level = 50;
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

            var name = getTranslation('pokes', chosenLang, nameId, pokes[i].name);
            
            var printedNature = natureBaseId;
            if (window['natures' + chosenLang] && window['natures' + chosenLang][natureBaseId]) {
                printedNature = window['natures' + chosenLang][natureBaseId];
            }

            var ability = getTranslation('abilities', chosenLang, abilityId, pokes[i].ability);
            var item = 'NO ITEM';
            if (itemId != 'NOITEM'){
                item = getTranslation('items', chosenLang, itemId, pokes[i].item);
            }
            var movs = [];
            for (let x = 0; x < pokes[i].moves.length; x++){
                var moveId = MoveTranslator[pokes[i].moves[x]];
                movs.push(getTranslation('moves', chosenLang, moveId, pokes[i].moves[x]));
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
        doc.text(140, 40, msg, "right");
        doc.line(140, 41.5, 180, 41.5);
        drawMixedFontText(doc, playerId, 142, 40, 'text2', 13);

        doc.setFontSize(9);
        doc.setFont("text1", 'normal');
        var msg = "Date of Birth: ";
        doc.text(140, 47, msg, "right");
        doc.line(140, 48.5, 180, 48.5);
        drawMixedFontText(doc, birth, 142, 47, 'text2', 13);

        doc.setFontSize(9);
        doc.setFont("text1", 'normal');
        var msg = "Support ID: ";
        doc.text(140, 54, msg, "right");
        doc.line(140, 55.5, 180, 55.5);
        drawMixedFontText(doc, supportId, 142, 54, 'text2', 13);


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

        doc.addFileToVFS("fontSymbols.ttf", fontSymbols);
        doc.addFont('fontSymbols.ttf', 'fontSymbols', 'normal');

        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 100, 100);
        const line = canvas.toDataURL();

        drawMixedFontText(doc, playerName+" - "+trainerName, 20, 8, 'customFont', 14);
        doc.setFontSize(14);
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

        const gui = PrintLabels;

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
                    
                    var translatedPoke = getTranslation('pokes', currentLang, id, pokes[i].name);
                    var pokeTextWidth= doc.getStringUnitWidth(translatedPoke)*pokeFontSize;
                    var limitTextWidth=72;
                    if (u>=5) {
                        limitTextWidth=70;
                    }
                    while (pokeTextWidth>limitTextWidth) {
                        pokeFontSize-=0.5;
                        doc.setFontSize(pokeFontSize);
                        pokeTextWidth= doc.getStringUnitWidth(translatedPoke)*pokeFontSize;
                    }
                    if (u<5) {
                        doc.text(translatedPoke, 22+c_width*(i+1), ystart+8*ygap*u,"center");
                    } else {
                        doc.text(translatedPoke, 22+c_width*(i+1), ystart+0.4+8*ygap*u,"center");
                    }
                    doc.setFontSize(startFontSize);

                    var natIdBase = pokes[i].nature || 'Serious';
                    var translatedNature = natIdBase;
                    if (window['natures' + currentLang] && window['natures' + currentLang][natIdBase]) {
                        translatedNature = window['natures' + currentLang][natIdBase];
                    }
                    doc.text(translatedNature, 22+c_width*(i+1), ystart+ygap+8*ygap*u,"center");

                    id = AbilityTranslator[pokes[i].ability];
                    var translatedAbility = getTranslation('abilities', currentLang, id, pokes[i].ability);
                    var abilityFontSize=startFontSize;
                    var abilityTextWidth= doc.getStringUnitWidth(translatedAbility)*abilityFontSize;
                    while (abilityTextWidth>limitTextWidth) {
                        abilityFontSize-=0.5;
                        doc.setFontSize(abilityFontSize);
                        abilityTextWidth= doc.getStringUnitWidth(translatedAbility)*abilityFontSize;
                    }
                    doc.text(translatedAbility, 22+c_width*(i+1), ystart+2*ygap+8*ygap*u,"center");
                    doc.setFontSize(startFontSize);
                    
                    id = ItemTranslator[pokes[i].item];
                    var translatedItem = getTranslation('items', currentLang, id, pokes[i].item || "NO ITEM");
                    var itemFontSize=startFontSize;
                    var itemTextWidth= doc.getStringUnitWidth(translatedItem)*itemFontSize;
                    while (itemTextWidth>limitTextWidth) {
                        itemFontSize-=0.5;
                        doc.setFontSize(itemFontSize);
                        itemTextWidth= doc.getStringUnitWidth(translatedItem)*itemFontSize;
                    }
                    doc.text(translatedItem, 22+c_width*(i+1), ystart+3*ygap+8*ygap*u,"center");
                    doc.setFontSize(startFontSize);
                    for (let x = 0; x < pokes[i].moves.length; x++){
                        var moveId = MoveTranslator[pokes[i].moves[x]];
                        var translatedMove = getTranslation('moves', currentLang, moveId, pokes[i].moves[x]);
                        var moveFontSize=startFontSize;
                        var moveTextWidth= doc.getStringUnitWidth(translatedMove)*moveFontSize;
                        while (moveTextWidth>limitTextWidth) {
                            moveFontSize-=0.5;
                            doc.setFontSize(moveFontSize);
                            moveTextWidth= doc.getStringUnitWidth(translatedMove)*moveFontSize;
                        }
                        doc.text(translatedMove, 22+c_width*(i+1), ystart+4*ygap+30.4*u+ygap*x,"center");
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

// Screenshot-to-pokepaste parsing, running entirely in the browser via
// client-ocr/ (see that folder's pipeline.mjs) - no server, no upload.
function loadImageFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Could not read ${file.name} as an image.`));
        img.src = URL.createObjectURL(file);
    });
}

function setStatus(el, text, kind) {
    el.classList.remove('status-error', 'status-success', 'status-info');
    if (kind) el.classList.add('status-' + kind);
    el.innerText = text;
}

// One key per uncertain-field entry (see client-ocr/pipeline.mjs/
// movesCard.mjs/natureDetect.mjs) - "move" entries are the only ones that
// need `index` to disambiguate (a card can have up to 4 uncertain moves).
function uncertainKey(u) {
    return `${u.mon}-${u.field}-${u.index ?? ''}`;
}

// Custom-styled replacement for a native <input list>/<datalist> combo -
// browsers render datalist popups with their own OS-level chrome that can't
// be skinned to match the site, so this reimplements the same "type to
// filter a legality-checked option list" behavior as a plain positioned div.
// Appended to <body> (not the input's own row) and positioned via
// getBoundingClientRect() so it always floats above review-panel's own
// overflow-y:auto instead of being clipped by it.
function attachCombobox(input, options, onPick) {
    if (!options?.length) return;

    const listEl = document.createElement('div');
    listEl.className = 'review-combobox-list';
    listEl.hidden = true;
    document.body.appendChild(listEl);

    let visible = [];
    let highlighted = -1;

    function position() {
        const r = input.getBoundingClientRect();
        listEl.style.left = `${r.left}px`;
        listEl.style.top = `${r.bottom + 4}px`;
        listEl.style.width = `${r.width}px`;
    }

    function setHighlight(idx) {
        const optionEls = listEl.querySelectorAll('.review-combobox-option');
        optionEls.forEach((el) => el.classList.remove('highlighted'));
        highlighted = idx;
        if (idx >= 0 && idx < optionEls.length) {
            optionEls[idx].classList.add('highlighted');
            optionEls[idx].scrollIntoView({ block: 'nearest' });
        }
    }

    function render() {
        const q = input.value.trim().toLowerCase();
        visible = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
        listEl.innerHTML = '';
        highlighted = -1;
        if (!visible.length) {
            const empty = document.createElement('div');
            empty.className = 'review-combobox-empty';
            empty.textContent = 'No matches';
            listEl.appendChild(empty);
            return;
        }
        for (const opt of visible) {
            const optEl = document.createElement('div');
            optEl.className = 'review-combobox-option';
            optEl.textContent = opt;
            // mousedown (fires before the input's own blur handler closes
            // the list) rather than click, so a click on an option is
            // never lost.
            optEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
                pick(opt);
            });
            listEl.appendChild(optEl);
        }
    }

    function pick(value) {
        input.value = value;
        close();
        onPick(value);
    }

    function open() {
        render();
        position();
        listEl.hidden = false;
    }

    function close() {
        listEl.hidden = true;
    }

    input.addEventListener('focus', open);
    input.addEventListener('input', () => {
        render();
        position();
        listEl.hidden = false;
    });
    input.addEventListener('blur', close);
    input.addEventListener('keydown', (e) => {
        if (listEl.hidden) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(Math.min(highlighted + 1, visible.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(Math.max(highlighted - 1, 0));
        } else if (e.key === 'Enter') {
            if (highlighted >= 0 && visible[highlighted]) {
                e.preventDefault();
                pick(visible[highlighted]);
            }
        } else if (e.key === 'Escape') {
            close();
        }
    });
    // Scroll events don't bubble, but a capture-phase window listener still
    // sees them fire on any scrollable ancestor (incl. review-panel itself).
    window.addEventListener('scroll', () => { if (!listEl.hidden) position(); }, true);
    window.addEventListener('resize', () => { if (!listEl.hidden) position(); });
}

// Same end-of-scan manual-review screen as the standalone client-ocr.html
// build (see client-ocr/main.mjs) - reused here since this page shares the
// same processImages/renderPokepaste pipeline. Resolves to a Map of
// uncertainKey -> chosen value once the user confirms; every entry defaults
// to the pipeline's own best guess if left untouched.
function reviewUncertainFields(monData, uncertainList) {
    const reviewCard = document.getElementById('review-card');
    const reviewListEl = document.getElementById('review-list');
    const reviewConfirmBtn = document.getElementById('review-confirm');

    return new Promise((resolve) => {
        reviewListEl.innerHTML = '';
        // Leftover dropdown lists from a previous review round live on
        // <body>, not inside reviewListEl, so clearing reviewListEl above
        // doesn't remove them - do that here too.
        document.querySelectorAll('.review-combobox-list').forEach((el) => el.remove());
        const selections = new Map(uncertainList.map((u) => [uncertainKey(u), u.value]));

        for (const u of uncertainList) {
            const key = uncertainKey(u);
            const monName = monData[u.mon]?.name || `Pokemon ${u.mon + 1}`;
            const fieldLabel = u.field === 'move' ? `Move ${u.index + 1}` : u.field === 'evStr' ? 'EVs' : u.field[0].toUpperCase() + u.field.slice(1);

            const row = document.createElement('div');
            row.className = 'review-item';
            const title = document.createElement('div');
            title.className = 'review-item-title';
            title.textContent = `${monName} - ${fieldLabel}`;
            row.appendChild(title);

            const btnRow = document.createElement('div');
            btnRow.className = 'review-choices';
            const options = [...u.candidates];
            if (u.value && !options.some((c) => c.name === u.value)) {
                options.unshift({ name: u.value, confidence: 1 });
            }

            const manualInput = document.createElement('input');
            manualInput.type = 'text';
            manualInput.placeholder = u.field === 'evStr' ? 'e.g. 4 HP / 252 Atk / 252 Spe' : 'Or type it yourself...';
            manualInput.className = 'review-manual-input';

            // Back the manual-entry input with a custom-styled dropdown of
            // every legality-checked option for this field - the
            // move/ability this card's species can actually have, the
            // species consistent with its own ability+moves, or the items
            // Champions actually lets a Pokemon hold - same data the
            // ranked candidates above were already filtered against in
            // pipeline.mjs, just offered in full here since the manual box
            // is the fallback for when none of the top 5 candidates were
            // the right one.
            const legalOptions =
                u.field === 'move' ? u.legalMoves :
                u.field === 'ability' ? u.legalAbilities :
                u.field === 'name' ? u.legalSpecies :
                u.field === 'item' ? u.legalItems :
                null;

            for (const c of options.slice(0, 5)) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'review-choice-btn';
                btn.textContent = c.name;
                if (c.name === selections.get(key)) btn.classList.add('selected');
                btn.addEventListener('click', () => {
                    selections.set(key, c.name);
                    [...btnRow.querySelectorAll('button')].forEach((b) => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    manualInput.value = '';
                });
                btnRow.appendChild(btn);
            }
            row.appendChild(btnRow);

            function chooseManualValue(value) {
                if (!value.trim()) return;
                selections.set(key, value.trim());
                [...btnRow.querySelectorAll('button')].forEach((b) => b.classList.remove('selected'));
            }
            manualInput.addEventListener('input', () => chooseManualValue(manualInput.value));
            row.appendChild(manualInput);
            attachCombobox(manualInput, legalOptions, chooseManualValue);

            reviewListEl.appendChild(row);
        }

        reviewCard.style.display = '';
        reviewConfirmBtn.onclick = () => {
            reviewCard.style.display = 'none';
            document.querySelectorAll('.review-combobox-list').forEach((el) => el.remove());
            resolve(selections);
        };
    });
}

function applyReviewSelections(monData, uncertainList, selections) {
    for (const u of uncertainList) {
        const value = selections.get(uncertainKey(u));
        if (value === undefined) continue;
        if (u.field === 'move') monData[u.mon].moves[u.index] = value;
        else monData[u.mon][u.field] = value;
    }
}

async function executeUnifiedTeamScreenParsing() {
    const fileMoves = document.getElementById('img-moves').files[0];
    const fileStats = document.getElementById('img-stats').files[0];
    const lang = document.getElementById('screenshot-lang').value;
    const statusText = document.getElementById('parser-status');

    if (!fileMoves || !fileStats) {
        setStatus(statusText, 'Please select both image screenshots first.', 'error');
        return;
    }

    document.getElementById('review-card').style.display = 'none';
    document.getElementById('review-list').innerHTML = '';
    setStatus(statusText, 'Reading screenshots (running locally in your browser)...', 'info');

    try {
        const [imgMoves, imgStats] = await Promise.all([
            loadImageFile(fileMoves),
            loadImageFile(fileStats),
        ]);
        const idToNameByLang = await loadResourceBundle('./Resources', [lang]);

        const { monData, uncertain } = await processImages(imgMoves, imgStats, {
            idToNameByLang,
            pokedex: window.pokedex,
            lang,
            onProgress: (_step, index) => {
                setStatus(statusText, `Reading Pokemon ${index + 1} of 6...`, 'info');
            },
        });

        if (uncertain.length) {
            setStatus(statusText, `Found ${uncertain.length} low-confidence read${uncertain.length === 1 ? '' : 's'} - please review below.`, 'info');
            const selections = await reviewUncertainFields(monData, uncertain);
            applyReviewSelections(monData, uncertain, selections);
        }

        document.getElementById('paste').value = renderPokepaste(monData);
        setStatus(statusText, "Done! Team loaded below. You can click 'PRINT SELECTED' now.", 'success');
    } catch (error) {
        setStatus(statusText, `Error: ${error.message}`, 'error');
        console.error("Screenshot parsing error:", error);
    }
}

document.getElementById('btn-parse-screens').addEventListener('click', executeUnifiedTeamScreenParsing);

// Champions represents Mega Evolution purely through the held Mega Stone
// item, not a separate listed species - generatePdf's own Mega check
// (search "CANNOT BE LISTED ON A TEAMSHEET") hard-blocks the whole export
// if a "-Mega" species ever reaches it. A pasted Showdown team naturally
// spells a Mega-holding mon as e.g. "Charizard-Mega-Y" (that's the real
// in-battle form Showdown exports), so an imported paste would otherwise
// always trip that block - stripping the "-Mega"/"-Mega-X"/"-Mega-Y" suffix
// back to the base species here (leaving the stone item untouched) avoids
// that friction at the source instead of erroring the user out later.
// Species can appear two ways in Showdown paste text: bare at line start
// ("Charizard-Mega-Y @ Charizardite Y") or parenthesized after a nickname
// ("Zard (Charizard-Mega-Y) @ Charizardite Y") - both handled here.
function stripMegaFormSuffix(pasteText) {
    // pokepast.es (and Windows-authored pastes generally) exports CRLF line
    // endings - JS regex "." excludes *every* line-terminator character,
    // \r included, not just \n, so a per-line ".*" tail match silently
    // fails to consume a line's trailing "\r" and the whole pattern never
    // matches (confirmed for real: "Charizard-Mega-Y @ Charizardite Y  \r"
    // came back completely untouched). Normalizing to bare "\n" upfront
    // sidesteps that instead of trying to make every pattern below \r-safe.
    return pasteText
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => {
            const bare = line.match(/^([\w'.:-]+?)-Mega(?:-[XY])?(\s*@.*)?$/);
            if (bare && !line.includes('(')) return `${bare[1]}${bare[2] || ''}`;
            return line.replace(/\(([\w'.:-]+?)-Mega(?:-[XY])?\)/, '($1)');
        })
        .join('\n');
}

// Import a Showdown paste from a pokepast.es or vrpastes.com link.
// Runs entirely client-side; vrpastes.com goes through its public API with a
// CORS-proxy fallback since that API does not always send CORS headers.
async function importFromURL() {
    const statusText = document.getElementById('url-import-status');
    const urlInput = document.getElementById('paste-url');
    const urlValue = urlInput.value.trim();

    if (!urlValue) {
        setStatus(statusText, 'Please enter a URL first.', 'error');
        return;
    }

    setStatus(statusText, 'Importing...', 'info');

    try {
        let rawPaste = '';

        if (urlValue.includes('pokepast.es')) {
            let targetUrl = urlValue.replace(/\/$/, '');
            if (!targetUrl.endsWith('/json')) {
                targetUrl += '/json';
            }

            const response = await fetch(targetUrl);
            if (!response.ok) throw new Error('Could not download Pokepaste.');
            const data = await response.json();
            rawPaste = data.paste || '';
        }

        else if (urlValue.includes('vrpastes.com')) {
            const parts = urlValue.split('/');
            const pasteId = parts[parts.length - 1].split('?')[0];

            if (!pasteId) throw new Error('Could not extract paste ID from URL.');

            const apiUrl = `https://vrpaste-backend.vercel.app/api/paste/${pasteId}?lang=english`;

            let data = null;
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) throw new Error(`Status ${response.status}`);
                data = await response.json();
            } catch (e) {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
                const proxyResponse = await fetch(proxyUrl);
                if (!proxyResponse.ok) throw new Error(`Proxy returned ${proxyResponse.status}`);
                data = await proxyResponse.json();
            }

            if (!data || !data.teams || !Array.isArray(data.teams)) {
                throw new Error('Invalid team data returned from VR Pastes API.');
            }

            let reconstructedPaste = '';
            data.teams.forEach(pkmn => {
                if (!pkmn.name) return;

                if (pkmn.item && pkmn.item !== 'None') {
                    reconstructedPaste += `${pkmn.name} @ ${pkmn.item}\n`;
                } else {
                    reconstructedPaste += `${pkmn.name}\n`;
                }

                if (pkmn.ability) reconstructedPaste += `Ability: ${pkmn.ability}\n`;
                if (pkmn.teraType) reconstructedPaste += `Tera Type: ${pkmn.teraType}\n`;

                if (pkmn.evs) {
                    const evArray = [];
                    if (pkmn.evs.hp) evArray.push(`${pkmn.evs.hp} HP`);
                    if (pkmn.evs.atk) evArray.push(`${pkmn.evs.atk} Atk`);
                    if (pkmn.evs.def) evArray.push(`${pkmn.evs.def} Def`);
                    if (pkmn.evs.spa) evArray.push(`${pkmn.evs.spa} SpA`);
                    if (pkmn.evs.spd) evArray.push(`${pkmn.evs.spd} SpD`);
                    if (pkmn.evs.spe) evArray.push(`${pkmn.evs.spe} Spe`);
                    if (evArray.length > 0) reconstructedPaste += `EVs: ${evArray.join(' / ')}\n`;
                }

                if (pkmn.nature) reconstructedPaste += `${pkmn.nature} Nature\n`;

                if (pkmn.moves && Array.isArray(pkmn.moves)) {
                    pkmn.moves.forEach(move => {
                        reconstructedPaste += `- ${move}\n`;
                    });
                }

                reconstructedPaste += `\n`;
            });

            rawPaste = reconstructedPaste.trim();
        }

        else {
            setStatus(statusText, 'Unsupported website. Please paste a pokepast.es or vrpastes.com link.', 'error');
            return;
        }

        if (rawPaste) {
            document.getElementById('paste').value = stripMegaFormSuffix(rawPaste);
            setStatus(statusText, 'Team imported successfully.', 'success');
            urlInput.value = '';
        } else {
            setStatus(statusText, 'No team data found at that URL.', 'error');
        }
    } catch (error) {
        console.error(error);
        setStatus(statusText, 'Import failed: ' + error.message, 'error');
    }
}

document.getElementById('btn-import-url').addEventListener('click', importFromURL);