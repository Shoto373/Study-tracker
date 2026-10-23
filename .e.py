p='schemas.py'
s=open(p,encoding='utf-8').read()
s=s.replace("from pydantic import BaseModel, Field","from pydantic import BaseModel, ConfigDict, Field")
s=s.replace("    class Config:\n        from_attributes = True","    model_config = ConfigDict(from_attributes=True)")
open(p,'w',encoding='utf-8').write(s)

p='../README.md'
s=open(p,encoding='utf-8').read()
s=s.replace("## Структура","""## Тесты

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Тесты идут на in-memory SQLite, рабочая база не затрагивается.

## Структура""")
s=s.replace("- Тесты.\n","- Тесты для фронтенда.\n")
open(p,'w',encoding='utf-8').write(s)

p='../CLAUDE.md'
s=open(p,encoding='utf-8').read()
s=s.replace("No tests configured on either side.","Backend has pytest tests; frontend has none.")
s=s.replace("- Install: `pip install -r requirements.txt` (file is UTF-16 encoded)","- Install: `pip install -r requirements.txt` (file is UTF-16 encoded); tests: `pip install -r requirements-dev.txt`\n- Test: `pytest` (single test: `pytest test_api.py::test_subject_crud`); tests override `get_db` with in-memory SQLite")
s=s.replace("- Deleting a `Subject`","- Schemas validate input (non-empty name, `#RRGGBB` color, `duration_minutes` > 0). SQLite does not enforce FKs, so session/deadline create and update check the subject exists via `_require_subject` (404).\n- Deleting a `Subject`")
s=s.replace("CORS allows only `http://localhost:5173`.","CORS allows `http://localhost:5173` and `http://127.0.0.1:5173`.")
open(p,'w',encoding='utf-8').write(s)
