import { Cell as CellType } from "./game";

type Props = {
  row: number;
  col: number;
  cell: CellType;
  winning: boolean;
};

export default function Cell({ row, col, cell, winning }: Props) {
  return (
    <span
      className={winning ? "cell winning" : "cell"}
      data-testid={`cell-${row}-${col}`}
      data-player={cell}
    />
  );
}
