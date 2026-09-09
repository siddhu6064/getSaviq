import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { Bill, BillComputedStatus, computeBillStatus } from "../utils/billsStatus";

interface Props {
  bills: (Bill & { _status?: BillComputedStatus })[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function statusDotColor(status: BillComputedStatus, colors: any) {
  if (status === "overdue") return colors.expense;
  if (status === "due_soon") return colors.warning;
  if (status === "paid") return colors.income;
  return colors.textSecondary;
}

export function BillsCalendarView({ bills }: Props) {
  const { colors } = useTheme();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const todayDay = today.getDate();

  const billsByDay: Record<number, (Bill & { _status?: BillComputedStatus })[]> = {};
  bills.forEach((b) => {
    const effectiveDay = Math.min(b.due_day, daysInMonth);
    if (!billsByDay[effectiveDay]) billsByDay[effectiveDay] = [];
    billsByDay[effectiveDay].push(b);
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthName = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <View style={styles.container}>
      <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{monthName}</Text>

      <View style={styles.weekRow}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={[styles.weekLabel, { color: colors.textSecondary }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, idx) => {
          const dayBills = day ? billsByDay[day] || [] : [];
          const isToday = day === todayDay;
          return (
            <View
              key={idx}
              style={[
                styles.cell,
                day
                  ? { backgroundColor: colors.surface, borderColor: colors.border }
                  : { backgroundColor: "transparent", borderColor: "transparent" },
                isToday && { borderColor: colors.primary, borderWidth: 1.5 },
              ]}
            >
              {day && (
                <>
                  <View
                    style={[
                      styles.dayBadge,
                      isToday ? { backgroundColor: colors.primary } : undefined,
                    ]}
                  >
                    <Text
                      style={[styles.dayText, { color: isToday ? "#FFF" : colors.textSecondary }]}
                    >
                      {day}
                    </Text>
                  </View>
                  {dayBills.slice(0, 2).map((b) => {
                    const status = b._status || computeBillStatus(b);
                    return (
                      <View key={b.bill_id} style={styles.billRow}>
                        <View
                          style={[styles.dot, { backgroundColor: statusDotColor(status, colors) }]}
                        />
                        <Text
                          style={[styles.billName, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {b.name}
                        </Text>
                      </View>
                    );
                  })}
                  {dayBills.length > 2 && (
                    <Text style={[styles.moreText, { color: colors.textSecondary }]}>
                      +{dayBills.length - 2} more
                    </Text>
                  )}
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const CELL_WIDTH = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  monthLabel: { textAlign: "center", fontSize: 14, fontWeight: "700", marginBottom: 10 },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekLabel: { width: CELL_WIDTH, textAlign: "center", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: CELL_WIDTH,
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 3,
    marginBottom: 2,
  },
  dayBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  dayText: { fontSize: 10, fontWeight: "700" },
  billRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5, flexShrink: 0 },
  billName: { fontSize: 8, flex: 1 },
  moreText: { fontSize: 8, marginTop: 1 },
});
