import { COLS, type Board } from "./game";
import Column from "./Column";

type Props = {
  board: Board;
  disabled: boolean;
  winning: ReadonlySet<string>;
  onDrop: (col: number) => void;
};

export default function BoardComponent({ board, disabled, winning, onDrop }: Props) {
  return (
    <div className="board">
      {Array.from({ length: COLS }, (_, col) => (
        <Column
          key={col}
          col={col}
          cells={board.map((row) => row[col])}
          disabled={disabled}
          winning={winning}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}
