import prisma from "../../lib/prisma";
import { Todo } from "@prisma/client";
import { createTodo } from "./actions";
import TodoItem from "./TodoItem";

async function getTodos(): Promise<Todo[]> {
  try {
    const todos = await prisma.todo.findMany({
      orderBy: {
        id: "desc",
      },
    });
    return todos;
  } catch (error) {
    console.error("Error fetching todos:", error);
    return [];
  }
}

export default async function HomePage() {
  const todos = await getTodos();

  return (
    <main style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Next.js & PostgreSQL (Prisma) サンプル</h1>

      <form
        action={createTodo}
        style={{ marginBottom: "20px", display: "flex", gap: "10px" }}
      >
        <input
          type="text"
          name="title"
          placeholder="新しいTODOを入力"
          required
          style={{ padding: "8px", flexGrow: 1, border: "1px solid #ccc" }}
        />
        <button
          type="submit"
          style={{
            padding: "8px 15px",
            background: "green",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Prismaで追加
        </button>
      </form>

      <hr />

      <h2>TODOリスト</h2>
      {todos.length === 0 ? (
        <p>TODOはまだありません。上記フォームから追加してください。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {todos.map((todo: Todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
    </main>
  );
}
