# 300 Before 30 V1 prototype

Open `index.html` through a small local web server (fetching `master.json` requires HTTP rather than file:// in many browsers):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

This prototype:
- has the approved Home / My List / Me architecture;
- supports Cards/List, search, category/status filtering;
- supports add/edit/delete;
- supports standard, counter and checklist goals;
- simulates multiple independent username profiles on one browser/device;
- stores everything in localStorage;
- ships with all 300 starter titles in `master.json`.

For real multi-device use, use the Supabase plan in `PRODUCT_SPEC.md` and `supabase-schema.sql`.
