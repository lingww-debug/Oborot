"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CATEGORIES, CHANNELS, PALETTES, TEXT_GROUPS, channelKeys, formatPrice,
  type Palette, type Product, type SiteSettings, type TextKey,
} from "../../lib/content";
import { errorMessage, jsonRequest, requestJson } from "../../lib/client";
import { Brand, BrandMark } from "../brand";
import { Overlay } from "../overlay";

type AdminData = { settings: SiteSettings; revision: number; products: Product[] };
type SettingsTab = "copy" | "contacts" | "palette";
type Tab = "catalog" | SettingsTab;
const tabs: [Tab, string][] = [
  ["catalog", "Товары"], ["copy", "Тексты"], ["contacts", "Контакты"], ["palette", "Оформление"],
];

function Feedback({ notice, error }: { notice: string; error: string }) {
  return <>
    {notice && <p className="feedback success" role="status">{notice}</p>}
    {error && <p className="feedback inline-error" role="alert">{error}</p>}
  </>;
}

function ProductForm({ product, onSave }: { product: Product | null; onSave: (product: Product) => void }) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [demo, setDemo] = useState(product?.demo ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    if (product) {
      form.set("id", product.id);
      form.set("revision", String(product.revision));
    }
    form.set("demo", demo ? "1" : "0");
    if (removePhoto) form.set("removePhoto", "1");
    if (photo) form.set("photo", photo);
    setError("");
    setSaving(true);
    try {
      const result = await requestJson<{ product: Product }>("/api/admin/catalog", { method: "POST", body: form });
      onSave(result.product);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setSaving(false);
    }
  }

  const savedPhoto = !removePhoto && (product?.photoKey || demo) ? product?.photoUrl : null;
  const photoUrl = preview ?? savedPhoto;

  return (
    <form className="admin-form product-form" onSubmit={save}>
      <label>Название<input name="title" defaultValue={product?.title} required maxLength={100} placeholder="Например, iPhone 13" /></label>
      <div className="form-grid">
        <label>Категория<select name="category" defaultValue={product?.category ?? CATEGORIES[0]}>{CATEGORIES.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Цена, ₽<input name="price" type="number" inputMode="numeric" min={1} max={999999999} step={1} defaultValue={product?.price} required /></label>
      </div>
      <div className="form-grid">
        <label>Характеристики<input name="spec" defaultValue={product?.spec} maxLength={160} placeholder="128 ГБ, зелёный" /></label>
        <label>Состояние<input name="condition" defaultValue={product?.condition} required maxLength={90} placeholder="Например, хорошее" /></label>
      </div>
      <label>Описание<textarea name="description" defaultValue={product?.description} maxLength={1500} rows={3} /></label>
      <div className="photo-field">
        {photoUrl && <img src={photoUrl} alt="Предпросмотр фотографии товара" />}
        <div>
          <label>Фотография<input ref={fileInput} name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            if (selected && selected.size > 6 * 1024 * 1024) {
              event.target.value = "";
              setPhoto(null);
              setError("Фотография должна занимать до 6 МБ.");
              return;
            }
            setError("");
            setPhoto(selected);
            if (selected) setRemovePhoto(false);
          }} /></label>
          <p className="field-note">JPG, PNG или WebP до 6 МБ.</p>
          {photoUrl && (photo || product?.photoKey) && <button className="text-button" type="button" onClick={() => {
            if (fileInput.current) fileInput.current.value = "";
            setPhoto(null);
            setRemovePhoto(true);
          }}>Убрать фото</button>}
        </div>
      </div>
      <label className="check-label"><input type="checkbox" name="published" value="1" defaultChecked={product?.published ?? true} /> Показывать в каталоге</label>
      {product?.demo && <label className="check-label"><input type="checkbox" checked={demo} onChange={(event) => setDemo(event.target.checked)} /> Помечать как пример товара</label>}
      <Feedback notice="" error={error} />
      <button className="button primary" disabled={saving}>{saving ? "Сохраняем…" : product ? "Сохранить товар" : "Добавить товар"}</button>
    </form>
  );
}

function Catalog({ initial }: { initial: Product[] }) {
  const [products, setProducts] = useState(initial);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  function saved(product: Product) {
    setProducts((items) => [product, ...items.filter((item) => item.id !== product.id)]);
    setNotice(product.published ? "Товар сохранён и виден в каталоге." : "Товар сохранён и скрыт из каталога.");
    setError("");
    setEditing(null);
  }

  async function toggle(product: Product) {
    setPending(product.id);
    setError("");
    setNotice("");
    try {
      const result = await requestJson<{ product: Product }>("/api/admin/catalog", jsonRequest("PATCH", {
        id: product.id, revision: product.revision, published: !product.published,
      }));
      setProducts((items) => items.map((item) => item.id === product.id ? result.product : item));
      setNotice(result.product.published ? "Товар опубликован." : "Товар скрыт из каталога.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setPending(null);
    }
  }

  async function remove(product: Product) {
    setPending(product.id);
    setDeleteError("");
    try {
      await requestJson("/api/admin/catalog", jsonRequest("DELETE", { id: product.id, revision: product.revision }));
      setProducts((items) => items.filter((item) => item.id !== product.id));
      setNotice("Товар удалён.");
      setDeleting(null);
    } catch (problem) {
      setDeleteError(errorMessage(problem));
    } finally {
      setPending(null);
    }
  }

  return <>
    <div className="admin-section-head">
      <div><h2>Товары</h2><p>{products.filter((product) => product.published).length} в каталоге · {products.filter((product) => !product.published).length} скрыто</p></div>
      <button type="button" className="button primary" onClick={() => setEditing("new")}>Добавить товар <span aria-hidden="true">+</span></button>
    </div>
    <Feedback notice={notice} error={error} />
    {products.length > 0 ? <div className="admin-product-list">
      {products.map((product) => (
        <article className="admin-product" key={product.id}>
          <div className="admin-thumb">{product.photoUrl ? <img src={product.photoUrl} alt="" loading="lazy" /> : <BrandMark />}</div>
          <div className="admin-product-name">
            <h3>{product.title}</h3>
            <p>{product.category} · {formatPrice(product.price)}</p>
            <span className={product.published ? "status status-live" : "status"}>{product.published ? "На сайте" : "Скрыт"}</span>
            {product.demo && <span className="status status-demo">Пример</span>}
          </div>
          <div className="admin-product-actions">
            <button type="button" className="button secondary" disabled={pending !== null} onClick={() => setEditing(product)}>Изменить</button>
            <button type="button" className="button secondary" disabled={pending !== null} onClick={() => toggle(product)}>{product.published ? "Скрыть" : "Опубликовать"}</button>
            <button type="button" className="text-button danger" disabled={pending !== null} onClick={() => { setDeleteError(""); setDeleting(product); }}>Удалить</button>
          </div>
        </article>
      ))}
    </div> : <div className="empty-state">Добавьте первый товар, чтобы он появился в каталоге.</div>}
    {editing && <Overlay title={editing === "new" ? "Новый товар" : "Редактировать товар"} onClose={() => setEditing(null)}>
      <ProductForm product={editing === "new" ? null : editing} onSave={saved} />
    </Overlay>}
    {deleting && <Overlay title="Удалить товар?" onClose={() => { if (!pending) setDeleting(null); }}>
      <p>Карточка «{deleting.title}» будет удалена из каталога и админки.</p>
      <Feedback notice="" error={deleteError} />
      <div className="row-actions">
        <button type="button" className="button secondary" disabled={pending !== null} onClick={() => setDeleting(null)}>Отмена</button>
        <button type="button" className="button danger-button" disabled={pending !== null} onClick={() => remove(deleting)}>{pending ? "Удаляем…" : "Удалить"}</button>
      </div>
    </Overlay>}
  </>;
}

export function AdminConsole({ initial }: { initial: AdminData }) {
  const [tab, setTab] = useState<Tab>("catalog");
  const [saved, setSaved] = useState(initial.settings);
  const [revision, setRevision] = useState(initial.revision);
  const [draft, setDraft] = useState(initial.settings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function changeText(key: TextKey, value: string) {
    setDraft((state) => ({ ...state, text: { ...state.text, [key]: value } }));
  }

  async function save(event: FormEvent<HTMLFormElement>, section: SettingsTab) {
    event.preventDefault();
    if (saving) return;
    const value = section === "copy" ? { text: draft.text, faq: draft.faq } : draft[section];
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJson<Omit<AdminData, "products">>("/api/admin/settings", jsonRequest("PUT", { section, value, revision }));
      setSaved(result.settings);
      setRevision(result.revision);
      setDraft((state) => section === "copy"
        ? { ...state, text: result.settings.text, faq: result.settings.faq }
        : { ...state, [section]: result.settings[section] });
      setNotice("Изменения сохранены на сайте.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-shell" data-palette={saved.palette}>
    <header className="admin-header"><div className="admin-wrap">
      <Brand />
      <a className="button secondary" href="/" target="_blank" rel="noopener noreferrer">Открыть сайт <span aria-hidden="true">↗</span></a>
    </div></header>
    <main className="admin-wrap admin-main">
      <h1>Панель управления</h1>
      <nav className="admin-tabs" aria-label="Разделы админки">
        {tabs.map(([id, name]) => <button type="button" key={id} aria-pressed={tab === id} disabled={saving} onClick={() => {
          setTab(id);
          setError("");
          setNotice("");
        }}>{name}</button>)}
      </nav>
      <section className="admin-panel" hidden={tab !== "catalog"}><Catalog initial={initial.products} /></section>
      {tab === "copy" && <section className="admin-panel">
        <div className="admin-section-head"><div><h2>Тексты сайта</h2><p>Заголовки, описания, надписи на кнопках и частые вопросы.</p></div></div>
        <form className="admin-form" onSubmit={(event) => save(event, "copy")}>
          {TEXT_GROUPS.map((group) => <details className="copy-group" key={group.label}>
            <summary>{group.label}</summary>
            <div className="copy-fields">
              {group.fields.map(([key, label, fallback, max]) => <label key={key}>{label}
                {max > 145 ? <textarea value={draft.text[key]} rows={3} placeholder={fallback} maxLength={max} onChange={(event) => changeText(key, event.target.value)} />
                  : <input value={draft.text[key]} placeholder={fallback} maxLength={max} onChange={(event) => changeText(key, event.target.value)} />}
              </label>)}
            </div>
          </details>)}
          <details className="copy-group">
            <summary>Частые вопросы</summary>
            <div className="copy-fields">
              {draft.faq.map((item, index) => <div key={index} className="faq-editor">
                <label>Вопрос<input value={item.question} maxLength={160} onChange={(event) => setDraft((state) => ({
                  ...state, faq: state.faq.map((entry, i) => i === index ? { ...entry, question: event.target.value } : entry),
                }))} /></label>
                <label>Ответ<textarea value={item.answer} maxLength={900} rows={3} onChange={(event) => setDraft((state) => ({
                  ...state, faq: state.faq.map((entry, i) => i === index ? { ...entry, answer: event.target.value } : entry),
                }))} /></label>
                <button className="text-button danger" type="button" onClick={() => setDraft((state) => ({ ...state, faq: state.faq.filter((_, i) => i !== index) }))}>Удалить вопрос</button>
              </div>)}
              <button className="button secondary" type="button" disabled={draft.faq.length >= 12} onClick={() => setDraft((state) => ({ ...state, faq: [...state.faq, { question: "", answer: "" }] }))}>Добавить вопрос +</button>
            </div>
          </details>
          <Feedback notice={notice} error={error} />
          <button className="button primary" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить тексты"}</button>
        </form>
      </section>}
      {tab === "contacts" && <section className="admin-panel">
        <div className="admin-section-head"><div><h2>Контакты мастера</h2><p>Заполните только те способы связи, которые хотите показать на сайте. Они будут доступны в ремонте, каталоге и скупке.</p></div></div>
        <form className="admin-form contact-editor" onSubmit={(event) => save(event, "contacts")}>
          <label>Телефон<input type="tel" autoComplete="off" placeholder="+7 (___) ___-__-__" maxLength={36} value={draft.contacts.phone} onChange={(event) => setDraft((state) => ({
            ...state, contacts: { ...state.contacts, phone: event.target.value },
          }))} /><span className="field-note">Номер открывается после короткой проверки.</span></label>
          <div className="form-grid">{channelKeys.map((id) => <label key={id}>{CHANNELS[id].label}
            <input type="url" autoComplete="off" placeholder={CHANNELS[id].example} maxLength={400} value={draft.contacts[id]} onChange={(event) => setDraft((state) => ({
              ...state, contacts: { ...state.contacts, [id]: event.target.value },
            }))} />
          </label>)}</div>
          <p className="field-note">Используйте ссылки на чат. Ссылки, в которых указан номер телефона, тоже открываются после проверки.</p>
          <Feedback notice={notice} error={error} />
          <button className="button primary" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить контакты"}</button>
        </form>
      </section>}
      {tab === "palette" && <section className="admin-panel">
        <div className="admin-section-head"><div><h2>Оформление</h2><p>Выберите палитру и посмотрите её на сайте перед сохранением.</p></div></div>
        <form className="admin-form" onSubmit={(event) => save(event, "palette")}>
          <fieldset className="palette-options">
            <legend>Палитра сайта</legend>
            {(Object.keys(PALETTES) as Palette[]).map((id) => (
              <label className="palette-card" key={id}>
                <input type="radio" name="palette" value={id} checked={draft.palette === id} onChange={() => setDraft((state) => ({ ...state, palette: id }))} />
                <span className="palette-visual" data-palette={id}><BrandMark /><b>ОБОРОТ</b><i /><i /></span>
                <span className="palette-label">{PALETTES[id].label}{saved.palette === id && <span>На сайте</span>}</span>
              </label>
            ))}
          </fieldset>
          <Feedback notice={notice} error={error} />
          <div className="row-actions">
            <a className="button secondary" href={"/?palette=" + draft.palette} target="_blank" rel="noopener noreferrer">Посмотреть палитру ↗</a>
            <button className="button primary" disabled={saving}>{saving ? "Сохраняем…" : "Применить палитру"}</button>
          </div>
        </form>
      </section>}
    </main>
  </div>;
}
