import { Cell as CellType } from "./game";

type Props = {
    row: number;
    col: number;
    cell: CellType;
};

export default function Cell({ row, col, cell }: Props) {
    return (
        <span
        className="cell"
        data-testid={`cell-${row}-${col}`}
        data-player={cell}/>
    );
}