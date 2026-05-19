"import { useParams } from \"react-router-dom\";
import { ChessGame } from \"../components/ChessGame\";

export const PlayGame = () => {
  const { gameId } = useParams();
  return <ChessGame gameId={gameId} />;
};
"
