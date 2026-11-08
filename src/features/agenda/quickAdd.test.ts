import { describe, expect, it } from "vitest";
import { describeDueDate, parseQuickAdd, quickAddToInput } from "./quickAdd";

// 2026-11-07 是星期六，作为所有相对日期的固定基准
const NOW = new Date(2026, 10, 7, 10, 0, 0);

const parse = (input: string) => parseQuickAdd(input, NOW);

describe("parseQuickAdd · 标题与标签", () => {
  it("纯文本保持原标题", () => {
    const result = parse("交报价单");
    expect(result.title).toBe("交报价单");
    expect(result.chips).toHaveLength(0);
  });

  it("去掉多余空白", () => {
    const result = parse("  交   报价单  ");
    expect(result.title).toBe("交 报价单");
  });

  it("空输入返回空标题", () => {
    const result = parse("");
    expect(result.title).toBe("");
    expect(result.tags).toEqual([]);
  });

  it("解析单个标签", () => {
    const result = parse("交报价单 #工作");
    expect(result.title).toBe("交报价单");
    expect(result.tags).toEqual(["工作"]);
  });

  it("解析多个标签", () => {
    const result = parse("#工作 #Q4 交报价单 #紧急");
    expect(result.tags).toEqual(["工作", "Q4", "紧急"]);
    expect(result.title).toBe("交报价单");
  });

  it("标签去重", () => {
    const result = parse("#工作 #工作 开会");
    expect(result.tags).toEqual(["工作"]);
  });

  it("标签支持英文与连字符", () => {
    const result = parse("写文档 #side-project");
    expect(result.tags).toEqual(["side-project"]);
  });

  it("只有标签时标题为空", () => {
    const result = parse("#工作");
    expect(result.title).toBe("");
    expect(result.tags).toEqual(["工作"]);
  });

  it("标签上限 20 个", () => {
    const result = parse(
      `开会 ${Array.from({ length: 25 }, (_, index) => `#tag${index}`).join(" ")}`,
    );
    expect(result.tags).toHaveLength(20);
  });
});

describe("parseQuickAdd · 优先级", () => {
  it("一个感叹号", () => {
    expect(parse("写周报 !").priority).toBe(1);
  });

  it("两个感叹号", () => {
    expect(parse("写周报 !!").priority).toBe(2);
  });

  it("三个感叹号", () => {
    expect(parse("写周报 !!!").priority).toBe(3);
  });

  it("感叹号不影响标题", () => {
    expect(parse("写周报 !!!").title).toBe("写周报");
  });

  it("没有感叹号时为默认优先级", () => {
    expect(parse("写周报").priority).toBe(0);
  });

  it("感叹号生成 chip", () => {
    expect(parse("写周报 !!").chips).toContainEqual({ kind: "priority", label: "!!" });
  });
});

describe("parseQuickAdd · 日期", () => {
  it("今天", () => {
    expect(parse("交作业 今天").dueDate).toBe("2026-11-07");
  });

  it("明天", () => {
    expect(parse("交作业 明天").dueDate).toBe("2026-11-08");
  });

  it("后天", () => {
    expect(parse("交作业 后天").dueDate).toBe("2026-11-09");
  });

  it("大后天", () => {
    expect(parse("交作业 大后天").dueDate).toBe("2026-11-10");
  });

  it("周五", () => {
    expect(parse("开会 周五").dueDate).toBe("2026-11-13");
  });

  it("下周一", () => {
    expect(parse("开会 下周一").dueDate).toBe("2026-11-16");
  });

  it("中文月日", () => {
    expect(parse("体检 11月8日").dueDate).toBe("2026-11-08");
  });

  it("中文月日用号", () => {
    expect(parse("体检 11月8号").dueDate).toBe("2026-11-08");
  });

  it("已经过去的月日指向明年", () => {
    expect(parse("年度总结 1月1日").dueDate).toBe("2027-01-01");
  });

  it("ISO 日期", () => {
    expect(parse("评审 2026-11-20").dueDate).toBe("2026-11-20");
  });

  it("斜杠日期", () => {
    expect(parse("评审 11/8").dueDate).toBe("2026-11-08");
  });

  it("非法 ISO 日期给出警告", () => {
    const result = parse("评审 2026-13-45");
    expect(result.warnings).toContain("date");
    expect(result.dueDate).toBeNull();
  });
});

describe("parseQuickAdd · 时间", () => {
  it("24 小时制", () => {
    expect(parse("开会 15:00").dueAt).toBe(new Date(2026, 10, 7, 15, 0, 0).toISOString());
  });

  it("只有时间时默认今天", () => {
    const result = parse("开会 15:00");
    expect(result.dueDate).toBe("2026-11-07");
  });

  it("上午时间", () => {
    expect(parse("开会 09:05").dueAt).toBe(new Date(2026, 10, 7, 9, 5, 0).toISOString());
  });

  it("下午三点", () => {
    expect(parse("开会 下午3点").dueAt).toBe(new Date(2026, 10, 7, 15, 0, 0).toISOString());
  });

  it("晚上八点", () => {
    expect(parse("看电影 晚8点").dueAt).toBe(new Date(2026, 10, 7, 20, 0, 0).toISOString());
  });

  it("中文半点", () => {
    expect(parse("开会 下午3点半").dueAt).toBe(new Date(2026, 10, 7, 15, 30, 0).toISOString());
  });

  it("中文带分", () => {
    expect(parse("开会 下午3点45分").dueAt).toBe(new Date(2026, 10, 7, 15, 45, 0).toISOString());
  });

  it("日期加时间组合", () => {
    const result = parse("明天 15:00 交作业");
    expect(result.dueDate).toBe("2026-11-08");
    expect(result.dueAt).toBe(new Date(2026, 10, 8, 15, 0, 0).toISOString());
  });

  it("非法时钟不产生 dueAt", () => {
    const result = parse("开会 25:99");
    expect(result.dueAt).toBeNull();
  });
});

describe("parseQuickAdd · 提醒与重复", () => {
  it("提前 30 分钟", () => {
    const result = parse("交作业 提前30分钟");
    expect(result.remindMinutes).toBe(30);
    expect(result.chips).toContainEqual({ kind: "remind", label: "提前 30 分钟" });
  });

  it("提前 1 小时换算成 60 分钟", () => {
    expect(parse("交作业 提前1小时").remindMinutes).toBe(60);
  });

  it("识别每天重复并给出警告", () => {
    const result = parse("背单词 每天");
    expect(result.recurrence).toBe("每天");
    expect(result.warnings).toContain("recurrence");
  });

  it("识别每周三重复", () => {
    expect(parse("组会 每周三").recurrence).toBe("每周三");
  });

  it("重复语法不会被误判为日期", () => {
    expect(parse("组会 每周三").dueDate).toBeNull();
  });

  it("每月 1 号", () => {
    expect(parse("交租 每月1号").recurrence).toBe("每月1号");
  });
});

describe("parseQuickAdd · 组合语句", () => {
  it("完整句子", () => {
    const result = parse("明天 下午3点 交报价单 #工作 #Q4 !! 提前30分钟");
    expect(result.title).toBe("交报价单");
    expect(result.tags).toEqual(["工作", "Q4"]);
    expect(result.priority).toBe(2);
    expect(result.dueDate).toBe("2026-11-08");
    expect(result.dueAt).toBe(new Date(2026, 10, 8, 15, 0, 0).toISOString());
    expect(result.remindMinutes).toBe(30);
  });

  it("chips 覆盖所有解析类型", () => {
    const kinds = new Set(
      parse("明天 15:00 交作业 #工作 !!! 提前5分钟").chips.map((chip) => chip.kind),
    );
    expect([...kinds].sort()).toEqual(["date", "priority", "remind", "tag", "time"]);
  });

  it("标题里包含数字不误判", () => {
    expect(parse("买 3 个苹果").title).toBe("买 3 个苹果");
  });

  it("标题里的英文冒号不误判时间", () => {
    expect(parse("看 README: 第二节").dueAt).toBeNull();
  });
});

describe("quickAddToInput", () => {
  it("映射为创建待办请求", () => {
    const result = parse("明天 15:00 交报价单 #工作 !! 提前30分钟");
    expect(quickAddToInput(result)).toEqual({
      title: "交报价单",
      priority: 2,
      tags: ["工作"],
      dueDate: null,
      dueAt: new Date(2026, 10, 8, 15, 0, 0).toISOString(),
      remindMinutes: 30,
    });
  });

  it("只有日期时保留 dueDate", () => {
    const result = parse("交作业 明天");
    expect(quickAddToInput(result).dueDate).toBe("2026-11-08");
    expect(quickAddToInput(result).dueAt).toBeNull();
  });

  it("无日期时字段为 null", () => {
    expect(quickAddToInput(parse("随手记一笔")).dueDate).toBeNull();
  });
});

describe("describeDueDate", () => {
  it("今天/明天/后天", () => {
    expect(describeDueDate("2026-11-07", NOW)).toBe("今天");
    expect(describeDueDate("2026-11-08", NOW)).toBe("明天");
    expect(describeDueDate("2026-11-09", NOW)).toBe("后天");
  });

  it("其它日期显示月日", () => {
    expect(describeDueDate("2026-11-20", NOW)).toBe("11月20日");
  });

  it("空值返回空串", () => {
    expect(describeDueDate(null, NOW)).toBe("");
  });
});
