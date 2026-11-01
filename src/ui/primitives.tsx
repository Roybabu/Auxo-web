import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
export function InputField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & {label: string}) {
  const id = useId();
  return <label htmlFor={id}>{label}<input {...props} id={id}/></label>;
}
export function Table({headings, children}: {headings: string[]; children: ReactNode}) {
  return <div className="table-wrap"><table><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
export function Pending({title}: {title: string}) {
  return <section><h1>{title}</h1><p>This module is not implemented yet.</p><p>Its Android workflows will be added in a later phase.</p></section>;
}
