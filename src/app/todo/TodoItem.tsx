"use client";

import { Todo } from "@prisma/client";
import { useState, useRef, useEffect } from "react";
import { deleteTodo, updateTodo } from "./actions";

interface TodoItemProps {
  todo: Todo;
}

export default function TodoItem({ todo }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (title.trim() !== todo.title) {
      await updateTodo(todo.id, title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setTitle(todo.title);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("本当に削除しますか？")) {
      await deleteTodo(todo.id);
    }
  };

  return (
    <li
      style={{
        padding: "10px 0",
        borderBottom: "1px solid #eee",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ flexGrow: 1, marginRight: "10px" }}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setTitle(todo.title);
              setIsEditing(false);
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%",
              padding: "5px",
              fontSize: "inherit",
            }}
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            style={{ cursor: "pointer", display: "block" }}
            title="クリックして編集"
          >
            ID: {todo.id} - {title}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "5px" }}>
        <button
          onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking button
          onClick={handleSave}
          disabled={!isEditing || title === todo.title}
          style={{
            padding: "5px 10px",
            background: !isEditing || title === todo.title ? "#ccc" : "#0070f3",
            color: "white",
            border: "none",
            cursor:
              !isEditing || title === todo.title ? "not-allowed" : "pointer",
          }}
        >
          修正
        </button>
        <button
          onClick={handleDelete}
          style={{
            padding: "5px 10px",
            background: "red",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          削除
        </button>
      </div>
    </li>
  );
}
