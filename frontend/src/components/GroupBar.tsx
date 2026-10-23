import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ApiError, fetchFaculties, fetchGroups, fetchMyGroup, importSchedule } from '../api/client'
import type { ActivityDetail, PinnedGroup, TimetableOption } from '../api/client'
import Dropdown from './Dropdown'

interface Props {
  onImported: () => void
}

interface PendingChange {
  target: PinnedGroup
  activity: ActivityDetail
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`
}

function GroupBar({ onImported }: Props) {
  const [faculties, setFaculties] = useState<TimetableOption[]>([])
  const [groups, setGroups] = useState<TimetableOption[]>([])
  // Группа, закреплённая за пользователем на сервере (по IP).
  const [pinned, setPinned] = useState<PinnedGroup | null>(null)
  const [faculty, setFaculty] = useState(0)
  const [groupName, setGroupName] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  // Пока true, после загрузки групп тихо обновляем предметы закреплённой группы.
  const bootSync = useRef<PinnedGroup | null>(null)

  useEffect(() => {
    fetchFaculties()
      .then(setFaculties)
      .catch(() => setMessage({ text: 'Не удалось загрузить список факультетов', error: true }))
    fetchMyGroup()
      .then((me) => {
        if (!me) return
        bootSync.current = me
        setPinned(me)
        setFaculty(me.faculty)
        setGroupName(me.group_name)
      })
      .catch(() => setMessage({ text: 'Не удалось получить сохранённую группу', error: true }))
  }, [])

  useEffect(() => {
    if (!faculty) return
    fetchGroups(faculty)
      .then((list) => {
        setGroups([...list].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
        const boot = bootSync.current
        if (boot && boot.faculty === faculty) {
          bootSync.current = null
          sync(boot, true)
        }
      })
      .catch(() => setMessage({ text: 'Не удалось загрузить список групп', error: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faculty])

  const query = groupName.trim().toLowerCase()
  const matches = groups.filter((g) => g.name.toLowerCase().includes(query))
  const group = groups.find((g) => g.name === groupName.trim())

  async function sync(target: PinnedGroup, silent: boolean, confirm = false) {
    setLoading(true)
    try {
      const result = await importSchedule({ ...target, confirm })
      setPinned(target)
      setPending(null)
      onImported()
      if (result.replaced) {
        setMessage({ text: `Группа изменена: загружено предметов ${result.created.length}`, error: false })
      } else if (!silent || result.created.length > 0) {
        setMessage({
          text:
            result.created.length > 0
              ? `Добавлено предметов: ${result.created.length}`
              : 'Новых предметов нет, всё уже загружено',
          error: false,
        })
      }
    } catch (err) {
      const detail = err instanceof ApiError ? (err.detail as Partial<ActivityDetail> | undefined) : undefined
      if (err instanceof ApiError && err.status === 409 && detail?.code === 'has_activity') {
        setPending({ target, activity: detail as ActivityDetail })
      } else {
        setMessage({ text: 'Не удалось получить расписание. Попробуйте позже', error: true })
      }
    } finally {
      setLoading(false)
    }
  }

  function pickGroup(g: TimetableOption) {
    setGroupName(g.name)
    setOpen(false)
    sync({ faculty, group: g.id, group_name: g.name }, false)
  }

  function cancelChange() {
    // Возвращаем выбор к закреплённой группе.
    setPending(null)
    if (pinned) {
      setFaculty(pinned.faculty)
      setGroupName(pinned.group_name)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && matches.length > 0) {
      e.preventDefault()
      pickGroup(group ?? matches[0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <section className="card relative z-20">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-300">Группа</span>
        <Dropdown
          options={faculties}
          value={faculty}
          onChange={(id) => {
            setFaculty(id)
            setGroups([])
            setGroupName('')
            setMessage(null)
          }}
          placeholder="Факультет"
        />
        <div className="relative">
          <input
            value={groupName}
            onChange={(e) => {
              setGroupName(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
            placeholder="Номер группы"
            disabled={!faculty}
            autoComplete="off"
            className="field w-36"
            aria-label="Номер группы"
          />
          {open && matches.length > 0 && (
            <ul className="absolute left-0 top-11 z-30 max-h-60 w-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/40">
              {matches.map((g) => (
                <li
                  key={g.id}
                  // mousedown срабатывает раньше blur, иначе список закрылся бы до клика
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pickGroup(g)
                  }}
                  className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-slate-800 ${
                    g.id === group?.id ? 'text-blue-400' : 'text-slate-200'
                  }`}
                >
                  {g.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => group && sync({ faculty, group: group.id, group_name: group.name }, false)}
          disabled={!group || loading}
          className="btn"
        >
          {loading ? 'Загрузка...' : 'Обновить'}
        </button>
        {message && (
          <span className={`text-sm ${message.error ? 'text-red-400' : 'text-slate-400'}`}>
            {message.text}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Группа закрепляется за вашим устройством. При смене группы предметы заменяются предметами новой группы.
      </p>

      {pending &&
        // В портале: backdrop-blur у карточки иначе ограничил бы fixed-окно её размерами.
        createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-md bg-slate-900">
            <h2 className="text-lg font-semibold">Сменить группу?</h2>
            <p className="mt-2 text-sm text-slate-300">
              У вас уже есть активность: занятий {pending.activity.sessions}, всего{' '}
              {formatMinutes(pending.activity.minutes)}. При смене на группу «{pending.target.group_name}» все
              текущие предметы, занятия и дедлайны будут удалены безвозвратно.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={cancelChange} className="btn bg-slate-700 hover:bg-slate-600">
                Оставить как есть
              </button>
              <button onClick={() => sync(pending.target, false, true)} disabled={loading} className="btn bg-red-600 hover:bg-red-500">
                Сменить и удалить
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}

export default GroupBar
