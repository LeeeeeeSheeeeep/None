#define _CRT_SECURE_NO_WARNINGS 1

#include "contact.h"

// ----------------------------------------------------------------------------------
// 内部辅助工具函数 (只在 contact.c 内部使用, 用 static 修饰)
// ----------------------------------------------------------------------------------

// 💡 静态辅助函数 static
//    用 static 修饰函数, 可以使该函数只能在当前 .c 文件中被访问, 实现隐藏和封装, 
//    防止与其他源文件中的同名函数产生命名冲突.
static int FindByName(const Contact* pc, const char* name)
{
    // 遍历当前已存的所有联系人
    for (int i = 0; i < pc->sz; i++)
    {
        // 💡 字符串比较: 必须使用 strcmp, 当返回值为 0 时代表字符串内容完全一致.
        if (strcmp(pc->data[i].name, name) == 0)
        {
            return i; // 找到了, 返回数组下标
        }
    }
    return -1; // 没找到, 返回 -1
}

// 💡 清空输入缓冲区: 防止用户多输入的字符残留在缓冲区中, 破坏下一次 scanf 的输入.
static void ClearInputBuffer(void)
{
    int c;
    while ((c = getchar()) != '\n' && c != EOF)
    {
        ; // 循环读取直到换行符或文件结束符, 将其丢弃
    }
}

// ----------------------------------------------------------------------------------
// 核心业务功能实现
// ----------------------------------------------------------------------------------

// 初始化通讯录
void InitContact(Contact* pc)
{
    if (pc == NULL)
    {
        return;
    }
    pc->sz = 0;
    // 💡 memset 快速清空内存: 将整个数组的所有字节初始化为 0.
    //    对字符数组来说, 0 就是 '\0' (字符串结束符), 这保证了所有字符串初始都为空.
    memset(pc->data, 0, sizeof(pc->data));
}

// 增加联系人
void AddContact(Contact* pc)
{
    if (pc == NULL)
    {
        return;
    }

    // 1. 判断通讯录是否已满 (100个人限制)
    if (pc->sz == MAX)
    {
        printf("添加失败: 通讯录已满!\n");
        return;
    }

    // 2. 依次读入新联系人信息
    // 💡 限制输入长度: %19s 代表最多只读取 19 个字符, 防止缓冲区溢出导致数组崩溃.
    //    由于数组大小是 20, 留出第 20 个位置存放字符串结束标志 '\0'.
    printf("请输入名字(最多19个字符): ");
    scanf("%19s", pc->data[pc->sz].name);
    ClearInputBuffer(); // 每次读取字符串后清空一下缓冲区, 防止多余输入干扰后续步骤

    printf("请输入年龄: ");
    while (scanf("%d", &(pc->data[pc->sz].age)) != 1 || pc->data[pc->sz].age < 0)
    {
        printf("输入无效! 请输入一个合法的年龄(大于等于0): ");
        ClearInputBuffer(); // 清空错误输入, 避免死循环
    }
    ClearInputBuffer();

    printf("请输入性别(最多9个字符): ");
    scanf("%9s", pc->data[pc->sz].sex);
    ClearInputBuffer();

    printf("请输入电话(最多14个字符): ");
    scanf("%14s", pc->data[pc->sz].tele);
    ClearInputBuffer();

    printf("请输入地址(最多29个字符): ");
    scanf("%29s", pc->data[pc->sz].addr);
    ClearInputBuffer();

    // 3. 数量累加,并提示成功
    pc->sz++;
    printf("--- 添加联系人成功 ---\n");
}

// 显示所有联系人
void ShowContact(const Contact* pc)
{
    if (pc == NULL)
    {
        return;
    }

    if (pc->sz == 0)
    {
        printf("当前通讯录为空, 无联系人信息.\n");
        return;
    }

    // 💡 格式化对齐打印:
    //    %-20s 表示左对齐, 宽度为 20 字符. 负号表示左对齐, 正号或无符号表示右对齐.
    //    这能让控制台输出像表格一样整齐漂亮.
    printf("\n=========================================================================\n");
    printf("%-20s\t%-5s\t%-10s\t%-15s\t%-30s\n", "姓名", "年龄", "性别", "电话", "地址");
    printf("-------------------------------------------------------------------------\n");
    for (int i = 0; i < pc->sz; i++)
    {
        printf("%-20s\t%-5d\t%-10s\t%-15s\t%-30s\n", 
               pc->data[i].name, 
               pc->data[i].age, 
               pc->data[i].sex, 
               pc->data[i].tele, 
               pc->data[i].addr);
    }
    printf("=========================================================================\n\n");
}

// 删除指定联系人
void DelContact(Contact* pc)
{
    if (pc == NULL)
    {
        return;
    }

    if (pc->sz == 0)
    {
        printf("删除失败: 当前通讯录为空!\n");
        return;
    }

    char name[MAX_NAME] = { 0 };
    printf("请输入要删除的联系人姓名: ");
    scanf("%19s", name);
    ClearInputBuffer();

    // 1. 查找是否存在该联系人
    int index = FindByName(pc, name);
    if (index == -1)
    {
        printf("删除失败: 未找到名为 [%s] 的联系人.\n", name);
        return;
    }

    // 2. 删除数据 (元素前移覆盖)
    // 💡 数组删除算法:
    //    将要删除的位置之后的每一个元素都往前挪动一位.
    //    注意: 循环的终点是 pc->sz - 1, 防止 data[i+1] 发生数组越界访问.
    for (int i = index; i < pc->sz - 1; i++)
    {
        pc->data[i] = pc->data[i + 1];
    }

    // 3. 更新数量
    pc->sz--;
    printf("--- 删除联系人成功 ---\n");
}

// 查找指定联系人并显示
void SearchContact(const Contact* pc)
{
    if (pc == NULL)
    {
        return;
    }

    if (pc->sz == 0)
    {
        printf("通讯录为空!\n");
        return;
    }

    char name[MAX_NAME] = { 0 };
    printf("请输入要查找的联系人姓名: ");
    scanf("%19s", name);
    ClearInputBuffer();

    int index = FindByName(pc, name);
    if (index == -1)
    {
        printf("未找到名为 [%s] 的联系人.\n", name);
        return;
    }

    // 打印找到的联系人
    printf("\n--- 找到联系人信息 ---\n");
    printf("%-20s\t%-5s\t%-10s\t%-15s\t%-30s\n", "姓名", "年龄", "性别", "电话", "地址");
    printf("-------------------------------------------------------------------------\n");
    printf("%-20s\t%-5d\t%-10s\t%-15s\t%-30s\n\n", 
           pc->data[index].name, 
           pc->data[index].age, 
           pc->data[index].sex, 
           pc->data[index].tele, 
           pc->data[index].addr);
}

// 修改指定联系人信息
void ModifyContact(Contact* pc)
{
    if (pc == NULL)
    {
        return;
    }

    if (pc->sz == 0)
    {
        printf("通讯录为空!\n");
        return;
    }

    char name[MAX_NAME] = { 0 };
    printf("请输入要修改的联系人姓名: ");
    scanf("%19s", name);
    ClearInputBuffer();

    int index = FindByName(pc, name);
    if (index == -1)
    {
        printf("未找到名为 [%s] 的联系人.\n", name);
        return;
    }

    // 找到后进行修改
    printf("已找到该联系人, 请输入修改后的信息:\n");

    printf("请输入新名字(最多19个字符): ");
    scanf("%19s", pc->data[index].name);
    ClearInputBuffer();

    printf("请输入新年龄: ");
    while (scanf("%d", &(pc->data[index].age)) != 1 || pc->data[index].age < 0)
    {
        printf("输入无效! 请输入一个合法的年龄(大于等于0): ");
        ClearInputBuffer();
    }
    ClearInputBuffer();

    printf("请输入新性别(最多9个字符): ");
    scanf("%9s", pc->data[index].sex);
    ClearInputBuffer();

    printf("请输入新电话(最多14个字符): ");
    scanf("%14s", pc->data[index].tele);
    ClearInputBuffer();

    printf("请输入新地址(最多29个字符): ");
    scanf("%29s", pc->data[index].addr);
    ClearInputBuffer();

    printf("--- 修改联系人成功 ---\n");
}

// ----------------------------------------------------------------------------------
// 排序相关实现
// ----------------------------------------------------------------------------------

// 💡 比较函数回调 (用以传给标准库 qsort 函数)
//    qsort 规定比较函数的参数类型必须是 const void*, 所以我们在内部要强转为 PeoInfo*
static int cmp_by_name(const void* e1, const void* e2)
{
    return strcmp(((const PeoInfo*)e1)->name, ((const PeoInfo*)e2)->name);
}

static int cmp_by_age(const void* e1, const void* e2)
{
    return (((const PeoInfo*)e1)->age - ((const PeoInfo*)e2)->age);
}

// 排序函数主入口
void SortContact(Contact* pc)
{
    if (pc == NULL)
    {
        return;
    }

    if (pc->sz < 2)
    {
        printf("人数少于2人, 无需排序.\n");
        return;
    }

    printf("请选择排序规则:\n");
    printf("1. 按姓名排序 (A-Z)\n");
    printf("2. 按年龄排序 (从小到大)\n");
    printf("请选择: ");

    int choice = 0;
    while (scanf("%d", &choice) != 1 || (choice != 1 && choice != 2))
    {
        printf("选择无效! 请重新选择(1或2): ");
        ClearInputBuffer();
    }
    ClearInputBuffer();

    if (choice == 1)
    {
        // 💡 运用标准库快速排序 qsort:
        //    参数 1: 待排序数组的首地址
        //    参数 2: 待排序的元素个数
        //    参数 3: 每个元素占用的字节大小
        //    参数 4: 比较函数的指针 (回调函数)
        qsort(pc->data, pc->sz, sizeof(PeoInfo), cmp_by_name);
        printf("--- 按姓名排序完成 ---\n");
    }
    else
    {
        qsort(pc->data, pc->sz, sizeof(PeoInfo), cmp_by_age);
        printf("--- 按年龄排序完成 ---\n");
    }

    // 排序后自动展示, 方便用户核对结果
    ShowContact(pc);
}
