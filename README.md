# MAISON — Butik online (React + ASP.NET Core)
    npm install
    npm run dev

- Produktet, kategoritë, transporti, kuponët: src/data.js
- Fotot: vendosi te public/foto/ dhe te produkti shkruaj img:'/foto/emri.jpg'
- Shporta/të preferuarat ruhen në localStorage; katalogu ngarkohet nga backend-i kur API-ja është online.
- Porosia: ruhet nga backend-i ASP.NET Core në SQLite.

## Backend-i (C# / ASP.NET Core)

Kërkohet .NET 10 SDK. Në Windows, mënyra më e thjeshtë është të hapësh `Start-Admin.cmd` nga dosja kryesore e projektit. Ai hap frontend-in në një dritare të veçantë dhe nis backend-in në dritaren ku u hap komanda. Mbaji të dyja dritaret hapur dhe cakto emrin e fjalëkalimin e administratorit kur të kërkohen.

Nëse preferon terminale, hape një terminal në dosjen kryesore dhe nis API-n me `dotnet run --project Maison.Api`; mbaje atë terminal hapur. Në një terminal të dytë, ekzekuto `npm run dev` për faqen. `npm run dev` nis vetëm frontend-in; pa API-n në punë, porositë dhe funksionet e tjera të backend-it nuk do të përgjigjen. Frontend-i punon në `http://localhost:4173`, API-ja në `http://localhost:5000`. Kontrollo API-n te `http://localhost:5000/health`.

## Publikimi në internet

Për ta hapur dyqanin nga telefoni ose kompjuteri i klientit, publikoje në një VPS Linux me Docker Compose dhe një domain tëndin. Ky konfigurim ndërton React dhe ASP.NET Core si një aplikacion të vetëm; Caddy ofron HTTPS automatik, ndërsa databaza SQLite dhe çelësat e sesionit ruhen në volume të qëndrueshme. API-ja nuk ekspozohet drejtpërdrejt në internet.

1. Në DNS të domain-it, drejto rekordin A te IP-ja publike e VPS-së. Lejo portet TCP 80 dhe 443 (dhe UDP 443 për HTTP/3) në firewall.
2. Në server, instalo Docker Engine dhe plugin-in Docker Compose, kopjo projektin dhe hyr te dosja kryesore.
3. Kopjo `.env.example` në `.env`, vendos domain-in real dhe një fjalëkalim të gjatë e unik për administratorin. Mbroj skedarin: `chmod 600 .env`. Mos e dërgo ose publikojë.
4. Nise me `docker compose up -d --build`, pastaj kontrollo `docker compose logs -f app caddy`. Kur certifikata HTTPS të krijohet, klientët mund të hapin `https://<domaini-yt>`. Kontrollo shëndetin te `https://<domaini-yt>/health`.
5. Hyrja e administratorit është `https://<domaini-yt>/admin/porosite`, me kredencialet nga `.env`. Vendos `PAYPAL_MODE=Live` dhe kredencialet Live vetëm kur llogaria PayPal Business është gati. SMTP është opsional dhe nevojitet vetëm për rikthimin e fjalëkalimit.

Vëllimet `maison_data`, `caddy_data` dhe `caddy_config` duhet të mbeten të ruajtura gjatë përditësimit ose rinisjes së kontejnerëve. Bëj kopje rezervë të databazës rregullisht; para kopjimit manual, ndalo shërbimin `app` që SQLite të mos shkruajë në atë kohë. Ky konfigurim nuk e publikon vetë faqen: nevojiten ende VPS, domain, DNS dhe qasje administratori te hosti.

## Hapja lokale me dy klikime (Windows)

Për demonstrim në kompjuterin e dyqanit, shkarko `Maison-Butik-Windows.zip`, zgjidh **Extract All / Ekstrakto të gjitha**, pastaj kliko dy herë `MAISON.exe`. Vendos një fjalëkalim administratori me të paktën 12 karaktere dhe kliko “Nise dyqanin”; faqja hapet vetë në shfletues. Panelin e porosive dhe ndaljen e aplikacionit i kontrollon nga dritarja MAISON. Nuk kërkon instalim të .NET-it ose Node.js. Ky version lokal ruan porositë vetëm në kompjuterin ku ekzekutohet dhe nuk është publik në internet; klientët nuk mund të dërgojnë porosi te dyqani nga kompjuterët e tyre derisa të kryhet publikimi më sipër. Kredencialet e administratorit ruhen vetëm gjatë kohës sa programi është hapur.

## Bashkëpunimi

Për të kontribuar, hap një issue me problemin ose idenë, pastaj dërgo një pull request me ndryshimin. Për instalimin lokal, përdor udhëzimet më sipër; për backend-in nevojitet .NET 10 SDK. Mos ngarko `.env`, databaza, fjalëkalime, çelësa API ose skedarët e paketimit `Maison-Butik-Windows`.

Udhëzimet për pull request dhe formularët për raportim janë në `.github/` dhe [CONTRIBUTING.md](./CONTRIBUTING.md). Licenca dhe të drejtat për ripërdorimin e kodit/fotove duhet të përcaktohen përpara publikimit të depos.

Endpoint-et kryesore:

- `GET /api/products` dhe `GET /api/products/{id}` — katalogu.
- `POST /api/orders` — krijon porosi me pagesë në dorëzim; serveri llogarit çmimet, kuponin, transportin dhe stokun.
- `POST /api/orders/track` — gjurmon porosinë me numrin e porosisë dhe email-in e blerësit.
- `POST /api/orders/{orderNumber}/cancel` — anulon porosinë vetëm kur është ende në statusin `Received` (Pranuar); stoku rikthehet.
- `POST /api/account/register`, `POST /api/account/login`, `POST /api/account/logout`, `GET /api/account/me` — regjistrimi dhe hyrja opsionale e klientit.
- `POST /api/admin/login` — hyrja e administratorit.
- `GET /api/admin/orders`, `PATCH /api/admin/orders/{id}/status` — kërkojnë sesion administratori.
- `/admin/porosite` — paneli i mbrojtur në frontend për porositë e javës aktuale (java nis të hënën sipas orës lokale të shfletuesit).
- `GET /api/admin/orders/week?fromUtc=...&toUtc=...` — porositë brenda intervalit të javës, kërkon sesion administratori.
- `POST /api/admin/products`, `PUT /api/admin/products/{id}`, `DELETE /api/admin/products/{id}` — menaxhimi i produkteve kërkon sesion administratori.

Nisësi kontrollon nëse portet 4173 dhe 5000 janë të lira, ndal vetëm API-n e këtij projekti nëse ka mbetur aktive dhe të kërkon kredencialet e administratorit (fjalëkalimi shkruhet në mënyrë të fshehur). Nëse paketat e frontend-it nuk janë instaluar, ekzekuto `npm install` në dosjen e projektit.

Mbaji të hapura dritarja e backend-it dhe dritarja e frontend-it. Pastaj hap `http://localhost:4173/admin/porosite` dhe hyr me kredencialet që vendose. Paneli shfaq porositë e javës aktuale (java nis të hënën sipas zonës kohore lokale të shfletuesit); sesioni ruhet me cookie `HttpOnly`. Përdor butonin “Rifresko” për porositë e reja. Paneli lejon edhe kalimin e statusit të porosisë.

Klientët mund të zgjedhin sasi për disa madhësi të të njëjtit produkt dhe t'i shtojnë në shportë me një veprim. Pas blerjes, numri i porosisë shfaqet në konfirmim; faqja `/order-tracking` përdor numrin dhe email-in për të shfaqur statusin dhe lejon anulimin për sa kohë porosia është vetëm e pranuar. Gjurmimi paraqet statusin e procesimit, jo lokacionin GPS të dërgesës.

Regjistrimi i klientit është opsional; blerja si mysafir vazhdon të jetë e mundur. Llogaritë përdorin fjalëkalime të hash-uara dhe cookie `HttpOnly`. Rikthimi i fjalëkalimit dërgon lidhje njëpërdorimëshe që skadon pas 60 minutave. Për ta aktivizuar, konfiguro SMTP-në në procesin e backend-it me `Email__Smtp__Host`, `Email__Smtp__Port`, `Email__Smtp__Username`, `Email__Smtp__Password`, `Email__Smtp__FromAddress`, `Email__Smtp__FromName`, `Email__Smtp__EnableSsl`, si dhe adresën e aplikacionit te `Email__FrontendBaseUrl`. Vendosi fjalëkalimet SMTP vetëm si variabla mjedisi ose sekrete në deployment, jo në kod.

Për testim në telefon, lidhe telefonin dhe kompjuterin në të njëjtin Wi-Fi, hape `Start-Admin.cmd` dhe përdor adresën LAN që shfaqet (p.sh. `http://192.168.1.20:4173`). API-ja dëgjon në ndërfaqet lokale të rrjetit në portin 5000, ndërsa frontend-i e zgjedh automatikisht host-in e API-së nga adresa e përdorur në shfletues. Nëse Windows Firewall pyet, lejo Node.js dhe .NET vetëm në rrjetet private. Kjo mënyrë është për zhvillim lokal, jo publikim në internet.

Databaza SQLite dhe stoku fillestar shërbejnë për zhvillim lokal. Para publikimit, përdor një databazë të menaxhuar me kopje rezervë, HTTPS, sekretet e deployment-it dhe monitorim.
