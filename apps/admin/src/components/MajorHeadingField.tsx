import { formatActivityMajorHeading } from "@sport-app/shared";

interface MajorHeadingFieldProps {
  id: string;
  value: string;
  majorHeadings: string[];
  onChange: (value: string) => void;
  required?: boolean;
}

export function MajorHeadingField({
  id,
  value,
  majorHeadings,
  onChange,
  required = true,
}: MajorHeadingFieldProps) {
  const listId = `${id}-headings`;

  return (
    <>
      <input
        id={id}
        type="text"
        className="admin-input"
        list={listId}
        required={required}
        value={value}
        placeholder="Sports или новая группа"
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {majorHeadings.map((heading) => (
          <option key={heading} value={heading}>
            {formatActivityMajorHeading(heading)}
          </option>
        ))}
      </datalist>
    </>
  );
}
