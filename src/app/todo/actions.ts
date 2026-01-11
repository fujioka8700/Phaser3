"use server";

import prisma from "../../lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTodo(formData: FormData) {
  const title = formData.get("title") as string;

  if (!title) {
    return;
  }

  try {
    await prisma.todo.create({
      data: {
        title: title,
      },
    });

    revalidatePath("/");
  } catch (error) {
    console.error("Error creating todo:", error);
  }
}

export async function deleteTodo(id: number) {
  try {
    await prisma.todo.delete({
      where: {
        id: id,
      },
    });
    revalidatePath("/");
  } catch (error) {
    console.error("Error deleting todo:", error);
  }
}

export async function updateTodo(id: number, title: string) {
  try {
    await prisma.todo.update({
      where: {
        id: id,
      },
      data: {
        title: title,
      },
    });
    revalidatePath("/");
  } catch (error) {
    console.error("Error updating todo:", error);
  }
}
