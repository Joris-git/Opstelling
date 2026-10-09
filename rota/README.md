# Rota op Cloudflare

Rota is de reisplanner uit `../algarve/index.html`, maar dan als eigen website.
Vrienden openen een reislink, kiezen hun naam en plannen mee. Ze hebben geen account nodig.

- **Cloudflare Pages** host de site en zet elke push naar GitHub automatisch online.
- **Cloudflare D1** (gratis database) bewaart reizen, stemmen, reacties en de route.
- **Een Pages Function** stuurt Claude-vragen door met jouw Anthropic API-sleutel. De sleutel staat alleen op de server.

## Eenmalig instellen (ongeveer 10 minuten)

### 1. Anthropic API-sleutel
1. Ga naar [console.anthropic.com](https://console.anthropic.com) en log in.
2. Zet wat tegoed op je account (Billing).
3. Maak bij **API Keys** een sleutel aan en kopieer hem. Je ziet hem maar één keer.

### 2. Database aanmaken
1. Open het Cloudflare-dashboard.
2. Ga naar **Storage & databases → D1** en klik op **Create database**.
3. Noem hem `rota-db`. De tabellen maakt de app zelf aan.

### 3. De site koppelen aan GitHub
1. Ga naar **Workers & Pages → Create → Pages → Connect to Git**.
2. Kies de repository `Opstelling` en vul in:

| Instelling | Waarde |
|---|---|
| Production branch | `algarve-reisapp` (of `main`, als je de branch hebt samengevoegd) |
| Framework preset | None |
| Root directory | `rota` |
| Build command | `npm install && node build.mjs` |
| Build output directory | `public` |

3. Klik op **Save and Deploy**.

### 4. Database en sleutel koppelen
Open het project en ga naar **Settings**:
1. Bij **Bindings**: **Add → D1 database**. Variable name `DB`, database `rota-db`.
2. Bij **Variables and Secrets**: voeg `ANTHROPIC_API_KEY` toe als **Secret**, met je sleutel als waarde.
3. Optioneel:
   - `AI_DAILY_LIMIT`: maximaal aantal Claude-vragen per reis per dag (standaard 60).
   - `CLAUDE_MODEL`: een ander model dan `claude-opus-5-5`, bijvoorbeeld `claude-sonnet-5-5` of `claude-haiku-5-5` als goedkopere optie.
4. Ga naar **Deployments** en kies **Retry deployment** bij de laatste versie, zodat de koppelingen actief worden.

### 5. Klaar
Open `https://<projectnaam>.pages.dev`, start een reis en deel de link met **Nodig uit**. Je kunt hem ook in de groepsapp plakken.
Wil je een eigen domein? Kies **Custom domains** in het project.

## Goed om te weten
- **Wie de link heeft, kan meedoen.** De code in de link is lang en willekeurig, dus niet te raden. Deel de link alleen met de groep.
- **Kosten van Claude:** een vraag kost met Claude Opus 5.5 grofweg een paar cent, afhankelijk van hoe lang de vraag en het antwoord zijn. De daglimiet per reis houdt het voorspelbaar. Ook mislukte vragen tellen mee voor die limiet.
- **Cloudflare** is ruim gratis voor een vriendengroep (Pages, Functions en D1 hebben ruime gratis limieten).
- **Live bijwerken:** wijzigingen van anderen verschijnen binnen ongeveer 4 seconden, zonder te herladen.

## Lokaal testen
```bash
cd rota
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run dev     # http://localhost:8788
```

## Hoe het in elkaar zit
| Bestand | Wat |
|---|---|
| `../algarve/index.html` | De app zelf (dezelfde als op claude.ai). |
| `build.mjs` | Maakt er `public/index.html` van en laadt `shim.js`. |
| `public/shim.js` | Koppelt de app aan deze site: opslag, wie je bent, wie er online is, Claude. |
| `functions/api/trips.js` | Nieuwe reis aanmaken. |
| `functions/api/sync.js` | Wijzigingen ophalen en aangeven wie er online is. |
| `functions/api/write.js` | Een document opslaan, samenvoegen of verwijderen (één transactie per wijziging). |
| `functions/api/claude.js` | Claude-vragen streamen, met de daglimiet. |
| `lib/store.js` | Databasetabellen en controles. |
