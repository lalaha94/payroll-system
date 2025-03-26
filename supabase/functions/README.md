# Brukeradministrasjon

Brukerroller administreres nå direkte i Supabase Authentication konsollen:

1. Gå til Supabase dashboard: https://supabase.com/dashboard
2. Velg ditt prosjekt
3. Gå til "Authentication" -> "Users"
4. Klikk på en bruker for å redigere
5. Under "Metadata" legg til enten:
   * `role` attributten med en verdi som "admin", "manager", eller "user", ELLER
   * `is_admin` og sett verdien til `true` for administratorbrukere

Eksempel på User Metadata JSON for rolle-basert tilgang:
```json
{
  "role": "admin",
  "name": "Administrator Navn"
}
```

ELLER alternativt:

```json
{
  "is_admin": true,
  "name": "Administrator Navn"
}
```

Disse metadata-feltene brukes direkte av applikasjonen for å bestemme brukerroller.
