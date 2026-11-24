'use client';

import {useEffect, useRef, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Select} from 'radix-ui';

type Option = {value: string; label: string};
const all = '__all__';

function Filter({name, label, placeholder, options, value, onChange}: {
  name: string; label: string; placeholder: string; options: Option[]; value: string; onChange: (value: string) => void;
}) {
  return <div className="catalog-filter">
    <input type="hidden" name={name} value={value}/>
    <Select.Root value={value || all} onValueChange={next => onChange(next === all ? '' : next)}>
      <Select.Trigger className="catalog-filter-trigger" aria-label={label}>
        <Select.Value placeholder={placeholder}/>
        <span className="catalog-filter-icon" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M3 5h14M5 10h10M8 15h4"/></svg></span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="catalog-filter-menu" position="popper" sideOffset={8} collisionPadding={12}>
          <Select.Viewport className="catalog-filter-options">
            {[{value: all, label: placeholder}, ...options].map(option => <Select.Item className="catalog-filter-option" key={option.value} value={option.value}>
              <Select.ItemText>{option.label}</Select.ItemText>
              <Select.ItemIndicator className="catalog-filter-check" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-9"/></svg></Select.ItemIndicator>
            </Select.Item>)}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  </div>;
}

type Filters = {q: string; category: string; needCategory: string};

export function CatalogFilters({productCategories, needCategories, productCategory, needCategory, query}: {
  productCategories: string[]; needCategories: ReadonlyArray<readonly [string, string]>;
  productCategory: string; needCategory: string; query: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({q: query, category: productCategory, needCategory});
  const latest = useRef(filters);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function restore() {
      if (timer.current) clearTimeout(timer.current);
      const params = new URLSearchParams(window.location.search);
      const restored = {q: params.get('q') ?? '', category: params.get('category') ?? '', needCategory: params.get('needCategory') ?? ''};
      latest.current = restored;
      setFilters(restored);
    }
    window.addEventListener('popstate', restore);
    return () => {window.removeEventListener('popstate', restore); if (timer.current) clearTimeout(timer.current)};
  }, []);

  function navigate(next: Filters, method: 'push' | 'replace') {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      const trimmed = value.trim();
      if (trimmed) params.set(key, trimmed); else params.delete(key);
    }
    const queryString = params.toString();
    const target = `/projects${queryString ? `?${queryString}` : ''}`;
    if (target === `${window.location.pathname}${window.location.search}`) return;
    startTransition(() => router[method](target, {scroll: false}));
  }

  function update(field: keyof Filters, value: string) {
    const next = {...latest.current, [field]: value};
    latest.current = next;
    setFilters(next);
    if (timer.current) clearTimeout(timer.current);
    if (field === 'q') timer.current = setTimeout(() => navigate(latest.current, 'replace'), 350);
    else navigate(next, 'push');
  }

  return <form className="search" action="/projects" onSubmit={event => {event.preventDefault(); if (timer.current) clearTimeout(timer.current); navigate(latest.current, 'push')}}>
    <input name="q" value={filters.q} maxLength={100} onChange={event => update('q', event.target.value)} placeholder="Search products, capabilities, needs or dependencies" aria-label="Search products, capabilities, needs or dependencies"/>
    <Filter name="category" label="Filter by product purpose" placeholder="All product purposes" value={filters.category} onChange={value => update('category', value)} options={productCategories.map(value => ({value, label: value}))}/>
    <Filter name="needCategory" label="Filter by builder need" placeholder="All builder needs" value={filters.needCategory} onChange={value => update('needCategory', value)} options={needCategories.map(([value, label]) => ({value, label}))}/>
    <button type="submit">Search</button>
    <span className="sr-only" role="status">{pending ? 'Updating results' : ''}</span>
  </form>;
}
