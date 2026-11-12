import type { Cell as CellType } from "./game";
import Cell from "./Cell";

type Props = {
  col: number;
  cells: CellType[];
  disabled: boolean;
  winning: ReadonlySet<string>;
  onDrop: (col: number) => void;
};

export default function Column({ col, cells, disabled, winning, onDrop }: Props) {
  const full = cells[0] !== 0;

  return (
    <button
      type="button"
      className="column"
      aria-label={`Drop in column ${col + 1}`}
      disabled={disabled || full}
      onClick={() => onDrop(col)}
    >
      {cells.map((value, row) => (
        <Cell
          key={row}
          row={row}
          col={col}
          cell={value}
          winning={winning.has(`${row}-${col}`)}
        />
      ))}
    </button>
  );
}
