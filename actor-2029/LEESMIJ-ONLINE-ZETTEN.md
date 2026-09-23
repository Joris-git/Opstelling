# Actor 2029 — online zetten

Deze handleiding is geschreven voor iemand zonder programmeerervaring. Je hoeft niets aan de code aan te passen — alleen een paar instellingen invullen en een paar commando's kopiëren.

Er zijn drie routes. Kies wat bij jullie situatie past:

1. **Lokaal draaien op een laptop** — om te testen of te oefenen, geen internet nodig.
2. **Online zetten bij een eenvoudige hostingpartij** — zodat groepen op hun eigen telefoon/laptop kunnen meedoen, of zodat je het van tevoren klaarzet.
3. **Voor een IT-beheerder van Actor** — draaien via Docker op een eigen server.

Aan het einde staat een **checklist voor de dag zelf**.

---

## Wat heb je nodig, ongeacht de route?

- Een **Anthropic API-sleutel** (optioneel, maar wel aan te raden voor de echte AI-toekomstbeelden). Zonder sleutel werkt het spel gewoon door — de app bouwt dan zelf een toekomstbeeld op uit de antwoorden van het team. Een sleutel maak je aan op [console.anthropic.com](https://console.anthropic.com/).
- Een **wachtwoord** dat jullie kiezen voor de beheerpagina (`/regie`).

Deze twee dingen (en een paar andere instellingen) komen in een bestand met de naam `.env`. In het project staat een voorbeeldbestand: `.env.example`. Dat kopieer je en hernoem je naar `.env`, en dan vul je de waarden in. Elke regel in `.env.example` heeft uitleg erboven.

---

## Route 1 — Lokaal draaien op een laptop

Handig om het spel van tevoren te testen, of om het op de dag zelf gewoon vanaf één laptop te draaien (bijvoorbeeld als alle groepen in dezelfde ruimte zijn en verbinding maken met het wifi-netwerk van die laptop).

### Stap 1 — Installeer Node.js

Node.js is het programma dat de app laat draaien.

- Ga naar [nodejs.org](https://nodejs.org/)
- Download de **LTS-versie** (het groene knopje) en installeer die zoals elk ander programma (Volgende, Volgende, Installeren).

### Stap 2 — Open de terminal en ga naar de projectmap

- **Mac**: open het programma "Terminal" (te vinden via spotlight-zoeken, cmd+spatie, typ "Terminal").
- **Windows**: open "PowerShell" (te vinden via het startmenu).

Typ vervolgens (pas het pad aan naar waar de map `actor-2029` op jouw computer staat):

```
cd pad/naar/actor-2029
```

### Stap 3 — Maak het instellingenbestand

Kopieer `.env.example` naar een nieuw bestand met de naam `.env` (in dezelfde map). Open `.env` met een gewoon teksteditor-programma (bijv. Kladblok of TextEdit) en vul in ieder geval in:

- `ADMIN_PASSWORD` — een wachtwoord dat jullie zelf kiezen.
- `SESSION_SECRET` — een willekeurige lange tekst (maakt niet uit wat, als het maar niet makkelijk te raden is).
- `ANTHROPIC_API_KEY` — jullie Anthropic-sleutel (optioneel, zie hierboven).

### Stap 4 — Installeer en start

Typ in de terminal, één voor één:

```
npm install
```

Dit duurt de eerste keer een minuutje. Daarna:

```
npm start
```

Je ziet iets als `Actor 2029 draait op http://localhost:3000`. Laat dit venster openstaan zolang je het spel wilt gebruiken.

### Stap 5 — Openen

- Open in een browser (Chrome, Edge of Safari): **http://localhost:3000**
- De beheerpagina staat op: **http://localhost:3000/regie**

### Andere laptops/telefoons meedoen op hetzelfde wifi-netwerk?

Zoek het IP-adres van de laptop die de app draait op (op Mac: Systeeminstellingen → Wifi → Details; op Windows: `ipconfig` in de terminal, kijk bij "IPv4-adres"). Andere apparaten op hetzelfde wifi-netwerk kunnen dan naar bijvoorbeeld `http://192.168.1.23:3000` gaan in plaats van `localhost`.

### Stoppen

Klik in het terminalvenster en druk op `Ctrl+C`.

### Data bewaard?

Ja. Alle gegevens staan in het bestand `data/actor-2029.db`. Zolang je die map niet verwijdert, blijft alles bewaard — ook na het herstarten van de app of de laptop.

---

## Route 2 — Online zetten bij een eenvoudige hostingpartij

Zo kan iedereen met zijn eigen laptop of telefoon meedoen, via een link, zonder dat iedereen op hetzelfde wifi-netwerk hoeft te zitten.

**Belangrijk om te weten:** deze app slaat gegevens op in één bestand (SQLite) dat op de schijf van de server blijft staan. Sommige heel eenvoudige hostingpartijen (zoals Vercel of Netlify) werken niet met een "gewone" schijf en zijn daarom **niet geschikt** — daar zou je voortgang verloren kunnen gaan. Kies een hostingpartij die een **Node.js-app** kan draaien mét een **permanente schijf ("persistent disk" of "volume")**.

Onderstaand voorbeeld gebruikt **Render.com**, een van de eenvoudigste opties. Railway.app en Fly.io werken op een vergelijkbare manier.

### Stap 1 — Zet het project op GitHub

Als het project nog niet op GitHub staat: maak een gratis GitHub-account aan op [github.com](https://github.com/), maak een nieuwe (privé) repository aan, en volg de instructies op die pagina om de projectmap te uploaden. (Vraag gerust iemand die hier al eens mee gewerkt heeft om te helpen — dit is de enige stap die iets technischer is.)

### Stap 2 — Maak een account bij Render.com

Ga naar [render.com](https://render.com/) en maak een (gratis) account aan. Koppel je GitHub-account.

### Stap 3 — Nieuwe "Web Service"

- Klik op **New → Web Service**.
- Kies de repository met het project.
- Vul in:
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
  - **Instance Type**: de goedkoopste optie is voldoende voor een bijeenkomst van een paar uur.

### Stap 4 — Een permanente schijf toevoegen

- Ga naar het tabblad **Disks** van je nieuwe service.
- Voeg een schijf toe, bijvoorbeeld gekoppeld op pad `/var/data`.
- Ga naar **Environment** en voeg een omgevingsvariabele toe: `DATA_DIR` = `/var/data`. (Dit vertelt de app om de database op die permanente schijf te zetten in plaats van een tijdelijke locatie.)

### Stap 5 — Omgevingsvariabelen instellen

Nog steeds op het tabblad **Environment**, voeg toe (zelfde waarden als in je `.env`-bestand):

- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `ANTHROPIC_API_KEY` (optioneel)
- `ANTHROPIC_MODEL` = `claude-sonnet-5` (optioneel, dit is al de standaard)
- `DATA_DIR` = `/var/data` (zoals hierboven)

### Stap 6 — Deploy

Render bouwt en start de app automatisch. Na een paar minuten krijg je een link zoals `https://actor-2029.onrender.com`. Dat is de link die je met de groepen deelt. De beheerpagina is `https://actor-2029.onrender.com/regie`.

### Test dit ruim van tevoren

Test een volledige speelronde minstens een paar dagen voor de bijeenkomst, inclusief het herladen van de pagina en het hervatten via de hervatcode.

---

## Route 3 — Voor een IT-beheerder van Actor

Deze route is voor iemand die gewend is met Docker of een eigen server te werken. Alles staat al klaar; er hoeft niets aan de code te worden aangepast.

### Optie A — Met Docker (aanbevolen)

In de projectmap staat een kant-en-klare `Dockerfile`.

```bash
# Bouw de image
docker build -t actor-2029 .

# Zorg voor een .env-bestand (kopie van .env.example, ingevuld)
# Start de container, met een gekoppelde map voor de data zodat die
# bewaard blijft ook als de container wordt vervangen:
docker run -d \
  --name actor-2029 \
  --env-file .env \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  actor-2029
```

De app is dan bereikbaar op poort 3000 van de server. Zet er eventueel een reverse proxy (nginx, Caddy, Traefik) voor, voor HTTPS en een nette domeinnaam.

Belangrijk: de map die je met `-v` koppelt (in dit voorbeeld `./data`) is waar het SQLite-bestand met alle spelgegevens komt te staan. Zorg dat die map regelmatig wordt meegenomen in de reguliere back-ups van de server.

### Optie B — Zonder Docker, rechtstreeks met Node.js

Zelfde als "Route 1", maar dan op een server: Node.js 18 of hoger installeren, `.env` invullen, `npm install`, en de app draaiend houden met een procesbeheerder zoals `pm2` of een systemd-service, zodat hij automatisch herstart bij een crash of server-reboot.

### Omgevingsvariabelen

Zie `.env.example` voor de volledige lijst met uitleg per regel. De belangrijkste: `ADMIN_PASSWORD`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `PORT` (standaard 3000), en optioneel `DATA_DIR` als de data-map ergens anders moet staan dan de standaardlocatie.

---

## Checklist voor de dag zelf

- [ ] **Laptops getest.** Open de start-URL op elk apparaat dat gebruikt gaat worden, in Chrome, Edge of Safari (schermbreedte minimaal 1280px). Doorloop minstens één keer de hele flow.
- [ ] **Testgroepen wissen.** Ga naar `/regie`, log in, en verwijder alle teams die tijdens het testen zijn aangemaakt (knop "Verwijder" per team), zodat het live overzicht op de dag zelf overzichtelijk blijft.
- [ ] **Geluid gecontroleerd.** Check op de gebruikte laptops of het geluid aanstaat en op een prettig niveau staat. Er is een dempknop rechtsboven in de app, zichtbaar vanaf het allereerste scherm.
- [ ] **Back-up van `data/` gemaakt.** Kopieer de map `data/` (of het bestand `actor-2029.db` erin) naar een veilige plek, vlak voordat de bijeenkomst begint. Zo kun je, mocht er iets misgaan, altijd terug naar een bekend goed punt.
- [ ] **Internetverbinding gecontroleerd.** Als jullie de AI-koppeling gebruiken (met een `ANTHROPIC_API_KEY`), test dan dat de internetverbinding op locatie werkt. Zonder werkende verbinding valt de app automatisch terug op een zelf opgebouwd toekomstbeeld — dat werkt ook prima, maar met AI is het net iets persoonlijker.
- [ ] **Beheerwachtwoord bij de hand.** Zorg dat degene die de bijeenkomst begeleidt het `/regie`-wachtwoord weet, voor het live overzicht en het gezamenlijke toekomstbeeld aan het einde.
- [ ] **Beamer/scherm getest.** Test de beamerweergave van een toekomstbeeld vanuit `/regie` vooraf op het scherm dat je die dag gebruikt.
