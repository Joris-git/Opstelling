# Eenvoudige, draagbare image: één Node.js-app, geen aparte databaseserver.
FROM node:20-bookworm-slim

WORKDIR /app

# Alleen de bestanden kopiëren die npm nodig heeft, zodat Docker de
# installatiestap kan hergebruiken (cache) zolang dependencies niet wijzigen.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Daarna pas de rest van de applicatie kopiëren.
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# De SQLite-database staat in data/ — dit als volume aanmerken zodat de
# gegevens blijven bestaan ook als de container wordt vervangen.
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
