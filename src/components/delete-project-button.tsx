"use client";

type DeleteProjectButtonProps = {
  projectName: string;
};

export function DeleteProjectButton({ projectName }: DeleteProjectButtonProps) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        event.stopPropagation();

        const confirmed = window.confirm(`确定要删除「${projectName}」吗？项目数据和本地文件都会被删除，此操作不可撤销。`);
        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className="rounded-full border border-red-900/60 px-3 py-1 text-xs text-red-300 transition hover:border-red-400 hover:text-red-200"
    >
      删除
    </button>
  );
}
