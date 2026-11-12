"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  CATEGORIES, CHANNELS, PALETTES, formatPrice, type Category, type Channel,
  type Palette, type Product, type PublicSettings,
} from "../lib/content";
import { errorMessage, jsonRequest, requestJson } from "../lib/client";
import { Brand, BrandMark } from "./brand";
import { Overlay } from "./overlay";

type Target = "phone" | Channel;
type Modal = { kind: "product"; product: Product }
  | { kind: "contacts"; title: string; prepared?: string }
  | { kind: "protected"; target: Target };

function ContactButtons({ settings, phoneLabel, onProtected, muted = false }: {
  settings: PublicSettings;
  phoneLabel: string;
  onProtected: (target: Target) => void;
  muted?: boolean;
}) {
  if (!settings.hasPhone && !settings.channels.length) {
    return <p className={muted ? "contact-empty on-dark" : "contact-empty"}>Контакты пока не указаны.</p>;
  }
  return (
    <div className="contact-buttons">
      {settings.channels.map(({ id, protected: protectedLink }) =>
        protectedLink
          ? <button key={id} type="button" className="button contact-button" onClick={() => onProtected(id)}>{CHANNELS[id].label} <span aria-hidden="true">↗</span></button>
          : <a key={id} className="button contact-button" href={"/connect/" + id} target="_blank" rel="noopener noreferrer">{CHANNELS[id].label} <span aria-hidden="true">↗</span></a>,
      )}
      {settings.hasPhone && <button type="button" className="button contact-button" onClick={() => onProtected("phone")}>{phoneLabel} <span aria-hidden="true">↗</span></button>}
    </div>
  );
}

function ProductImage({ product, eager = false }: { product: Product; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="product-image">
      {product.photoUrl && !failed
        ? <img src={product.photoUrl} alt={product.title} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />
        : <span className="missing-photo"><BrandMark /><span>Фото пока нет</span></span>}
    </div>
  );
}

function ContactCheck({ target }: { target: Target }) {
  const [phase, setPhase] = useState<"start" | "question" | "result">("start");
  const [question, setQuestion] = useState<{ id: string; prompt: string } | null>(null);
  const [result, setResult] = useState<{ phone?: string; url: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const loadQuestion = useCallback(async () => {
    setError("");
    setAnswer("");
    setBusy(true);
    try {
      setQuestion(await requestJson("/api/contact", jsonRequest("POST", { action: "challenge", target })));
      setPhase("question");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }, [target]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadQuestion();
  }, [loadQuestion]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question || busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(await requestJson("/api/contact", jsonRequest("POST", {
        action: "reveal", target, id: question.id, answer: answer.trim(),
      })));
      setPhase("result");
    } catch (problem) {
      setError(errorMessage(problem));
      setQuestion(null);
      setPhase("start");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "result" && result) {
    return result.phone
      ? <div className="number-reveal"><a className="revealed-number" href={result.url}>{result.phone}</a><a className="button primary" href={result.url}>Позвонить <span aria-hidden="true">↗</span></a></div>
      : <a className="button primary" href={result.url} target="_blank" rel="noopener noreferrer">Открыть {target !== "phone" && CHANNELS[target].label} <span aria-hidden="true">↗</span></a>;
  }
  return (
    <div className="check-panel">
      <p>Короткая проверка защищает номер от автоматического сбора.</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {phase === "question" && question
        ? <form className="check-form" onSubmit={verify}>
            <label>{question.prompt}<input inputMode="numeric" autoComplete="off" value={answer} onChange={(e) => setAnswer(e.target.value)} required maxLength={2} pattern="[0-9]{1,2}" placeholder="Ответ цифрами" autoFocus /></label>
            <button className="button primary" disabled={busy}>{busy ? "Проверяем…" : "Подтвердить"}</button>
          </form>
        : <button className="button primary" type="button" onClick={loadQuestion} disabled={busy}>
            {busy ? "Загружаем…" : error ? "Получить новый вопрос" : "Получить вопрос"}
          </button>}
    </div>
  );
}

function EstimateResult({ description }: { description: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(description);
      setStatus("Описание скопировано.");
    } catch {
      setStatus("Выделите текст и скопируйте его вручную.");
    }
  }
  return <div className="estimate-result">
    <textarea aria-label="Описание для оценки" rows={5} readOnly value={description} onFocus={(e) => e.target.select()} />
    <button type="button" className="button secondary" onClick={copy}>Скопировать описание</button>
    {status && <p className="field-note" role="status">{status}</p>}
    <p className="field-note">Передайте описание в выбранном мессенджере или озвучьте его по телефону.</p>
  </div>;
}

export function Storefront({ settings, products, admin, preview }: {
  settings: PublicSettings;
  products: Product[];
  admin: boolean;
  preview?: Palette;
}) {
  const [category, setCategory] = useState<Category | "all">(products.some((p) => p.category === "Смартфоны") ? "Смартфоны" : "all");
  const [modal, setModal] = useState<Modal | null>(null);
  const { text } = settings;
  const categories = CATEGORIES.filter((name) => products.some((product) => product.category === name));
  const visible = category === "all" ? products : products.filter((product) => product.category === category);
  const openProtected = (target: Target) => setModal({ kind: "protected", target });

  function prepareEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const description = [
      "Здравствуйте! Хочу продать смартфон.",
      "Категория: " + fields.get("category"),
      "Модель: " + String(fields.get("model")).trim(),
      "Состояние: " + String(fields.get("condition")).trim(),
    ].join("\n");
    setModal({ kind: "contacts", title: "Описание для оценки готово", prepared: description });
  }

  return (
    <div className="site-shell" data-palette={preview ?? settings.palette}>
      <a className="skip-link" href="#main">К содержимому</a>
      {preview && <div className="preview-banner">Предпросмотр палитры «{PALETTES[preview].label}» <a href="/">К текущему оформлению ↗</a></div>}
      <header className="site-header">
        <div className="container header-inner">
          <Brand href="#main" />
          <nav className="main-nav" aria-label="Основная навигация">
            <a href="#about">О нас</a><a href="#sell">{text.navSell}</a><a href="#repair">{text.navRepair}</a><a href="#catalog">{text.navCatalog}</a><a href="#contacts">{text.navContact}</a>
          </nav>
          <a className="button header-action" href="#sell">{text.sellAction} <span aria-hidden="true">↗</span></a>
        </div>
      </header>
      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            {text.heroLabel && <p className="hero-label"><span aria-hidden="true" />{text.heroLabel}</p>}
            <h1 id="hero-title">{text.heroTitle}{text.heroAccent && <span>{text.heroAccent}</span>}</h1>
            <p className="hero-description">{text.heroDescription}</p>
            <div className="hero-actions">
              <a className="button primary" href="#sell">{text.sellAction} <span aria-hidden="true">↗</span></a>
              <a className="button secondary" href="#catalog">{text.catalogAction} <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="hero-image">
            <span className="hero-orbit" aria-hidden="true" /><img src="/assets/sample-iphone.webp" alt="Смартфон в зелёном корпусе: вид спереди и сзади" fetchPriority="high" /><div className="hero-image-caption"><span>Больше возможностей.</span><span>Меньше лишнего.</span></div>
          </div>
        </section>
        <section id="about" className="about container">
          <div className="about-heading"><p className="section-kicker">ЗНАКОМИМСЯ / ОБОРОТ</p><h2>{text.aboutTitle}<br /><span>{text.aboutAccent}</span></h2></div>
          <div className="about-copy"><p>{text.aboutDescription}</p><p>{text.aboutDetail}</p></div>
        </section>
        <nav className="service-paths container" aria-label="Выберите задачу">
          <a href="#sell"><span className="path-number">01</span><div><h3>Продать смартфон</h3><p>Освободить место для нового.</p></div><span className="path-arrow" aria-hidden="true">↗</span></a>
          <a href="#repair"><span className="path-number">02</span><div><h3>Вернуть к жизни</h3><p>Починить то, что вам нравится.</p></div><span className="path-arrow" aria-hidden="true">↗</span></a>
          <a href="#catalog"><span className="path-number">03</span><div><h3>Найти свой телефон</h3><p>Дать хорошей вещи новую главу.</p></div><span className="path-arrow" aria-hidden="true">↗</span></a>
        </nav>
        <section id="sell" className="sell container">
          <div className="sell-copy">
            <p className="section-kicker">01 / ПРОДАТЬ</p><h2>{text.sellTitle}</h2>
            <p>{text.sellDescription}</p>
            <ol className="sell-steps">
              {[text.sellStepOne, text.sellStepTwo, text.sellStepThree].map((step, index) => (
                <li key={index}><span aria-hidden="true">{index + 1}</span>{step}</li>
              ))}
            </ol>
          </div>
          <form className="estimate-form" onSubmit={prepareEstimate}>
            <h3>{text.estimateTitle}</h3>
            <input type="hidden" name="category" value="Смартфоны" /><p className="form-intro">Начнём с вашего смартфона.</p>
            <label>Модель<input name="model" placeholder="Например, iPhone 13, 128 ГБ" required maxLength={100} pattern=".*\S.*" /></label>
            <label>Состояние<textarea name="condition" placeholder="Есть ли дефекты, менялись ли детали, что в комплекте?" required rows={3} maxLength={700} /></label>
            <button type="submit" className="button primary">{text.estimateAction} <span aria-hidden="true">↗</span></button>
          </form>
        </section>
        <section id="repair" className="container repair">
          <div className="repair-panel">
            <div className="repair-copy">
              <p className="section-kicker">02 / ПОЧИНИТЬ</p><h2>{text.repairTitle}</h2>
              <p>{text.repairDescription}</p>
              <button type="button" className="button repair-action" onClick={() => settings.hasPhone ? openProtected("phone") : setModal({ kind: "contacts", title: "Обсудить ремонт смартфона" })}>{settings.hasPhone ? text.repairPhone : "Связаться с мастером"} <span aria-hidden="true">↗</span></button>
            </div>
            <img className="repair-image" src="/assets/repair.webp" alt="Мастер разбирает смартфон на рабочем столе" loading="lazy" />
          </div>
        </section>
        <section id="catalog" className="catalog container">
          <div className="section-head">
            <div><p className="section-kicker">03 / ВЫБРАТЬ</p><h2>{text.catalogTitle}</h2></div>
            <p>{text.catalogDescription}</p>
          </div>
          <div className="catalog-contact"><span>Понравился телефон? Обсудим детали напрямую.</span><button type="button" className="text-button" onClick={() => setModal({ kind: "contacts", title: "Выберите удобный способ связи" })}>Все способы связи ↗</button></div>
          {products.length > 0 && (
            <div className="filters" role="group" aria-label="Фильтры каталога">
              <button type="button" className="filter" aria-pressed={category === "all"} onClick={() => setCategory("all")}>Вся техника</button>
              {categories.map((name) => <button key={name} type="button" className="filter" aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}
            </div>
          )}
          {visible.length ? <div className="product-grid">
            {visible.map((product) => (
              <button type="button" className="product-card" key={product.id} onClick={() => setModal({ kind: "product", product })} aria-label={"Открыть карточку: " + product.title}>
                <ProductImage product={product} />
                <div className="product-info">
                  <p className="product-status">{product.demo ? "Пример товара" : product.condition}</p>
                  <h3>{product.title}</h3>
                  <p className="product-spec">{product.spec || product.category}</p>
                  <div className="product-price"><strong>{formatPrice(product.price)}</strong><span aria-hidden="true">↗</span></div>
                </div>
              </button>
            ))}
          </div> : <div className="empty-state"><p>В каталоге пока нет товаров.</p><a className="text-link" href="#contacts">Уточнить поступление ↗</a></div>}
          {visible.some((product) => product.demo) && <p className="demo-note">Карточки с пометкой «Пример товара» демонстрируют оформление каталога. Устройства и цены в них приведены для примера.</p>}
        </section>
        {settings.faq.length > 0 && <section className="faq container">
          <h2>{text.faqTitle}</h2>
          <div>{settings.faq.map((item, index) => <details key={index}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
        </section>}
        <section id="contacts" className="container">
          <div className="contact-panel">
            <div>
              <h2>{text.contactTitle}</h2>
              <p>{text.contactDescription}</p>
              {text.location && <p className="contact-detail">{text.location}</p>}
              {text.hours && <p className="contact-detail">{text.hours}</p>}
            </div>
            <ContactButtons settings={settings} phoneLabel={text.contactPhone} onProtected={openProtected} />
          </div>
        </section>
      </main>
      <footer className="site-footer container">
        <Brand href="#main" />
        <p className="footer-tagline">{text.brandTagline}</p><div><a href="/pro">Для партнёров ↗</a>{admin && <a href="/admin">Админка ↗</a>}<a href="#main">Наверх ↑</a></div>
      </footer>
      {modal?.kind === "product" && <Overlay title={modal.product.title} onClose={() => setModal(null)}>
        <ProductImage product={modal.product} eager />
        <div className="detail-meta"><strong>{formatPrice(modal.product.price)}</strong><span>{modal.product.condition}</span></div>
        {modal.product.spec && <p>{modal.product.spec}</p>}
        {modal.product.description && <p className="pre-line">{modal.product.description}</p>}
        {modal.product.demo && <p className="demo-note">Демонстрационная карточка.</p>}
        <button className="button primary" type="button" onClick={() => setModal({ kind: "contacts", title: "Связаться по товару" })}>{text.productAction} <span aria-hidden="true">↗</span></button>
      </Overlay>}
      {modal?.kind === "contacts" && <Overlay title={modal.title} onClose={() => setModal(null)}>
        {modal.prepared && <EstimateResult description={modal.prepared} />}
        <ContactButtons settings={settings} phoneLabel={text.contactPhone} onProtected={openProtected} />
      </Overlay>}
      {modal?.kind === "protected" && <Overlay title={modal.target === "phone" ? "Номер телефона" : "Открыть " + CHANNELS[modal.target].label} onClose={() => setModal(null)}>
        <ContactCheck target={modal.target} key={modal.target} />
      </Overlay>}
    </div>
  );
}
