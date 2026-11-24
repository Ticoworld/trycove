'use client';

import {useState} from 'react';
import {Select} from 'radix-ui';

type Option = {value: string; label: string};
const all = '__all__';

function Filter({name, label, placeholder, options, initialValue}: {
  name: string; label: string; placeholder: string; options: Option[]; initialValue: string;
}) {
  const [value, setValue] = useState(initialValue || all);
  return <div className="catalog-filter">
    <input type="hidden" name={name} value={value === all ? '' : value}/>
    <Select.Root value={value} onValueChange={setValue}>
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

export function CatalogFilters({productCategories, needCategories, productCategory, needCategory}: {
  productCategories: string[]; needCategories: ReadonlyArray<readonly [string, string]>;
  productCategory: string; needCategory: string;
}) {
  return <>
    <Filter name="category" label="Filter by product purpose" placeholder="All product purposes" initialValue={productCategory} options={productCategories.map(value => ({value, label: value}))}/>
    <Filter name="needCategory" label="Filter by builder need" placeholder="All builder needs" initialValue={needCategory} options={needCategories.map(([value, label]) => ({value, label}))}/>
  </>;
}
