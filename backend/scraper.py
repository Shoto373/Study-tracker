"""Reads the RSREU timetable (rasp.rsreu.ru) and extracts faculties, groups and subject names."""
import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

BASE_URL = "https://rasp.rsreu.ru/schedule-frame/group"
# Numerator and denominator weeks differ, so read the current week and the following ones
# until the published timetable ends.
MAX_WEEKS = 8


class ScheduleUnavailable(Exception):
    pass


def _fetch(params: dict) -> str:
    url = f"{BASE_URL}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            raw = response.read()
    except (urllib.error.URLError, TimeoutError) as exc:
        raise ScheduleUnavailable(str(exc)) from exc
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1251", errors="replace")


def parse_faculties(page: str) -> list[dict]:
    select = re.search(r'<select name="faculty".*?</select>', page, re.S)
    if not select:
        return []
    return [
        {"id": int(value), "name": html.unescape(name).strip()}
        for value, name in re.findall(r'<option value="(\d+)"[^>]*>([^<]*)', select.group(0))
        if int(value) != 0
    ]


def parse_groups(page: str) -> list[dict]:
    match = re.search(r':options="(\[.*?\])"', page, re.S)
    if not match:
        return []
    options = json.loads(html.unescape(match.group(1)))
    return [{"id": o["value"], "name": o["label"]} for o in options if o["value"] != 0]


_CELL = re.compile(r'<td class="schedule-cell[^"]*"[^>]*>(.*?)</td>', re.S)
_ITEM = re.compile(r"</span>(.*?)(?:<br|<a\s|</div>)", re.S)


def _clean_name(raw: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", "", raw)).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"[,\s]*ауд\.?$", "", text)
    text = text.rstrip(", ")
    # Practical work is split by subgroup: "Subject, п.г. 1".
    text = re.sub(r",?\s*п\.\s?г\.\s*\d+$", "", text)
    text = text.strip(", ")
    # Some lessons list the same name twice: "Subject, Subject".
    doubled = re.fullmatch(r"(?P<n>.+?),\s*(?P=n)", text)
    return doubled.group("n") if doubled else text


def parse_subjects(page: str) -> list[dict]:
    """Subject names with the number of lessons per week they appear in the page."""
    counts: dict[str, int] = {}
    for cell in _CELL.findall(page):
        seen_in_cell = set()
        for item in _ITEM.findall(cell):
            name = _clean_name(item)
            if name:
                seen_in_cell.add(name)
        for name in seen_in_cell:
            counts[name] = counts.get(name, 0) + 1
    return [{"name": name, "lessons": count} for name, count in counts.items()]


def fetch_options(faculty: int) -> str:
    return _fetch({"faculty": faculty})


def fetch_subjects(faculty: int, group: int) -> list[dict]:
    """Subjects of the group over the published weeks.

    `lessons` is the average number of lessons per week, so a subject that only runs on
    every other week counts half. Weeks without any lessons (end of the timetable) are ignored.
    """
    weeks: list[list[dict]] = []
    monday = date.today() - timedelta(days=date.today().weekday())
    for week in range(MAX_WEEKS):
        params = {"faculty": faculty, "group": group}
        if week:
            params["date"] = (monday + timedelta(weeks=week)).isoformat()
        subjects = parse_subjects(_fetch(params))
        if not subjects:
            if week:
                break
            continue
        weeks.append(subjects)
    totals: dict[str, int] = {}
    for subjects in weeks:
        for subject in subjects:
            totals[subject["name"]] = totals.get(subject["name"], 0) + subject["lessons"]
    return [
        {"name": name, "lessons": round(total / len(weeks), 2)} for name, total in totals.items()
    ]
