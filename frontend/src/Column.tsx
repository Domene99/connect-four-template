import type { Cell as CellType } from "./game";
import Cell from "./Cell";

type Props = {
    col: number;
    cells: CellType[];
    // Hey, we managed to shut up the auto-complete. If someone is watching this say hurray!!!
    disabled: boolean;
    onDrop: (col: number) => void;
};

// Now I miss it.
export default function Column({col, cells, disabled, onDrop}: Props) {
    const full = cells[0] !== 0;

    return (
        <button
            type  = "button"
            className = "column"
            aria-label = {`Drop in column ${col + 1}`}
            disabled = {disabled || full}
            onClick = {() => onDrop(col)}
            >
                {cells.map((value, row) => (
                    <Cell key = {row} row = {row} col = {col} cell = {value} />
                ))}
        </button>
    )
}