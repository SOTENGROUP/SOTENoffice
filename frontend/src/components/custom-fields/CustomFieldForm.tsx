import { type FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import type { BoardRead } from "@/api/generated/model";
import { useTranslation } from "@/lib/i18n";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  CUSTOM_FIELD_TYPE_OPTIONS,
  CUSTOM_FIELD_VISIBILITY_OPTIONS,
  type CustomFieldFormMode,
  type CustomFieldFormState,
  STRING_VALIDATION_FIELD_TYPES,
} from "./custom-field-form-types";
import {
  extractApiErrorMessage,
  filterBoardsBySearch,
  normalizeCustomFieldFormInput,
  type NormalizedCustomFieldFormValues,
} from "./custom-field-form-utils";

type CustomFieldFormProps = {
  mode: CustomFieldFormMode;
  initialFormState: CustomFieldFormState;
  initialBoardIds?: string[];
  boards: BoardRead[];
  boardsLoading: boolean;
  boardsError: string | null;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  submitErrorFallback: string;
  cancelHref?: string;
  onSubmit: (values: NormalizedCustomFieldFormValues) => Promise<void>;
};

export function CustomFieldForm({
  mode,
  initialFormState,
  initialBoardIds = [],
  boards,
  boardsLoading,
  boardsError,
  isSubmitting,
  submitLabel,
  submittingLabel,
  submitErrorFallback,
  cancelHref = "/custom-fields",
  onSubmit,
}: CustomFieldFormProps) {
  const { t } = useTranslation();
  const [formState, setFormState] =
    useState<CustomFieldFormState>(initialFormState);
  const [boardSearch, setBoardSearch] = useState("");
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(
    () => new Set(initialBoardIds),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredBoards = useMemo(
    () => filterBoardsBySearch(boards, boardSearch),
    [boardSearch, boards],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const normalized = normalizeCustomFieldFormInput({
      mode,
      formState,
      selectedBoardIds,
    });
    if (normalized.value === null) {
      setSubmitError(normalized.error);
      return;
    }

    try {
      await onSubmit(normalized.value);
    } catch (error) {
      setSubmitError(extractApiErrorMessage(error, submitErrorFallback));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("customFields.sectionBasicConfig")}
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {t("customFields.fieldKeyLabel")}
            </span>
            <Input
              value={formState.fieldKey}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  fieldKey: event.target.value,
                }))
              }
              placeholder={t("customFields.fieldKeyPlaceholder")}
              readOnly={mode === "edit"}
              disabled={isSubmitting || mode === "edit"}
              required={mode === "create"}
            />
            {mode === "edit" ? (
              <span className="text-xs text-slate-500">
                {t("customFields.fieldKeyReadOnly")}
              </span>
            ) : null}
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {t("customFields.labelLabel")}
            </span>
            <Input
              value={formState.label}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, label: event.target.value }))
              }
              placeholder={t("customFields.labelPlaceholder")}
              disabled={isSubmitting}
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {t("customFields.fieldTypeLabel")}
            </span>
            <Select
              value={formState.fieldType}
              onValueChange={(value) =>
                setFormState((prev) => ({
                  ...prev,
                  fieldType: value as CustomFieldFormState["fieldType"],
                }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("customFields.fieldTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FIELD_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {t("customFields.uiVisibleLabel")}
            </span>
            <Select
              value={formState.uiVisibility}
              onValueChange={(value) =>
                setFormState((prev) => ({
                  ...prev,
                  uiVisibility: value as CustomFieldFormState["uiVisibility"],
                }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("customFields.visibilityPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FIELD_VISIBILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={formState.required}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                required: event.target.checked,
              }))
            }
            disabled={isSubmitting}
          />
          {t("customFields.requiredLabel")}
        </label>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {t("customFields.sectionValidation")}
        </p>
        <div className="mt-4 space-y-4">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {t("customFields.validationRegexLabel")}
            </span>
            <Input
              value={formState.validationRegex}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  validationRegex: event.target.value,
                }))
              }
              placeholder={t("customFields.validationRegexPlaceholder")}
              disabled={
                isSubmitting ||
                !STRING_VALIDATION_FIELD_TYPES.has(formState.fieldType)
              }
            />
            <p className="text-xs text-slate-500">
              {t("customFields.validationRegexHint")}
            </p>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {t("customFields.defaultValueLabel")}
            </span>
            <Textarea
              value={formState.defaultValue}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  defaultValue: event.target.value,
                }))
              }
              rows={3}
              placeholder={t("customFields.defaultValuePlaceholder")}
              disabled={isSubmitting}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-slate-900">
              {t("customFields.descriptionLabel")}
            </span>
            <Textarea
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={3}
              placeholder={t("customFields.descriptionPlaceholder")}
              disabled={isSubmitting}
            />
          </label>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("customFields.sectionBoardBindings")}
          </p>
          <span className="text-xs text-slate-500">
            {t("customFields.boardBindingsSelected").replace(
              "{count}",
              String(selectedBoardIds.size),
            )}
          </span>
        </div>
        <div className="mt-4 space-y-2">
          <Input
            value={boardSearch}
            onChange={(event) => setBoardSearch(event.target.value)}
            placeholder={t("customFields.searchBoardsPlaceholder")}
            disabled={isSubmitting}
          />
          <div className="max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50/40">
            {boardsLoading ? (
              <div className="px-4 py-6 text-sm text-slate-500">
                {t("customFields.loadingBoards")}
              </div>
            ) : boardsError ? (
              <div className="px-4 py-6 text-sm text-rose-700">
                {boardsError}
              </div>
            ) : filteredBoards.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">
                {t("customFields.noBoardsFound")}
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {filteredBoards.map((board) => {
                  const checked = selectedBoardIds.has(board.id);
                  return (
                    <li key={board.id} className="px-4 py-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                          checked={checked}
                          onChange={() => {
                            setSelectedBoardIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(board.id)) {
                                next.delete(board.id);
                              } else {
                                next.add(board.id);
                              }
                              return next;
                            });
                          }}
                          disabled={isSubmitting}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {board.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {board.slug}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {t("customFields.boardBindingsHint")}
          </p>
        </div>
      </div>

      {submitError ? (
        <p className="text-sm text-rose-600">{submitError}</p>
      ) : null}
      <div className="flex items-center gap-2">
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "outline" })}
          aria-disabled={isSubmitting}
        >
          {t("common.cancel")}
        </Link>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
