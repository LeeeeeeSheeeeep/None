#define _CRT_SECURE_NO_WARNINGS 1

#include "contact_advanced.h"

// 💡 动态通讯录管理结构体的完整定义 (内部细节对外部不可见)
struct Contact
{
    PeoInfo* data;         // 指向动态分配数组的指针
    int sz;                // 当前已存放的联系人个数
    int capacity;          // 当前已分配的数组最大容量
};

// 查找辅助函数
static int FindByName(const Contact* pc, const char* name)
{
    for (int i = 0; i < pc->sz; i++)
    {
        if (strcmp(pc->data[i].name, name) == 0)
        {
            return i;
        }
    }
    return -1;
}

// 清空输入缓冲区
void ClearInputBuffer(void)
{
    int c;
    while ((c = getchar()) != '\n' && c != EOF)
    {
        ;
    }
}

// 动态扩容机制
static ContactStatus CheckAndGrow(Contact* pc)
{
    if (pc->sz < pc->capacity)
    {
        return CONTACT_SUCCESS;
    }

    if (pc->capacity >= MAX_LIMIT)
    {
        return CONTACT_ERR_FULL;
    }

    int new_capacity = pc->capacity * 2;
    if (new_capacity > MAX_LIMIT)
    {
        new_capacity = MAX_LIMIT;
    }

    // realloc 安全写法, 使用 temp 指针
    PeoInfo* temp = (PeoInfo*)realloc(pc->data, new_capacity * sizeof(PeoInfo));
    if (temp == NULL)
    {
        return CONTACT_ERR_MALLOC;
    }

    pc->data = temp;
    pc->capacity = new_capacity;
    printf("--- 触发自动扩容: 当前容量已增加至 %d ---\n", pc->capacity);
    return CONTACT_SUCCESS;
}

// 创建并分配空间
Contact* CreateContact(ContactStatus* pStatus)
{
    Contact* pc = (Contact*)malloc(sizeof(Contact));
    if (pc == NULL)
    {
        if (pStatus) *pStatus = CONTACT_ERR_MALLOC;
        return NULL;
    }

    pc->data = (PeoInfo*)malloc(INIT_CAPACITY * sizeof(PeoInfo));
    if (pc->data == NULL)
    {
        free(pc);
        if (pStatus) *pStatus = CONTACT_ERR_MALLOC;
        return NULL;
    }

    pc->sz = 0;
    pc->capacity = INIT_CAPACITY;
    if (pStatus) *pStatus = CONTACT_SUCCESS;
    return pc;
}

// 销毁并释放所有分配内存
void DestroyContact(Contact* pc)
{
    if (pc != NULL)
    {
        free(pc->data);
        pc->data = NULL;
        free(pc);
    }
}

// 添加联系人
ContactStatus AddContact(Contact* pc)
{
    if (pc == NULL)
    {
        return CONTACT_ERR_NULL_PTR;
    }

    ContactStatus status = CheckAndGrow(pc);
    if (status != CONTACT_SUCCESS)
    {
        if (status == CONTACT_ERR_FULL)
        {
            printf("添加失败: 通讯录已满!\n");
        }
        else
        {
            printf("添加失败: 内存扩容错误!\n");
        }
        return status;
    }

    printf("请输入名字(最多19个字符): ");
    if (scanf("%19s", pc->data[pc->sz].name) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    printf("请输入年龄: ");
    int res = 0;
    while ((res = scanf("%d", &(pc->data[pc->sz].age))) != 1 || pc->data[pc->sz].age < 0)
    {
        if (res == EOF || feof(stdin))
        {
            return CONTACT_ERR_EOF;
        }
        printf("输入无效! 请输入合法年龄: ");
        ClearInputBuffer();
    }
    ClearInputBuffer();

    printf("请输入性别(最多9个字符): ");
    if (scanf("%9s", pc->data[pc->sz].sex) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    printf("请输入电话(最多14个字符): ");
    if (scanf("%14s", pc->data[pc->sz].tele) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    printf("请输入地址(最多29个字符): ");
    if (scanf("%29s", pc->data[pc->sz].addr) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    pc->sz++;
    printf("--- 添加联系人成功 ---\n");
    return CONTACT_SUCCESS;
}

// 删除联系人
ContactStatus DelContact(Contact* pc)
{
    if (pc == NULL)
    {
        return CONTACT_ERR_NULL_PTR;
    }
    if (pc->sz == 0)
    {
        printf("删除失败: 通讯录为空!\n");
        return CONTACT_ERR_EMPTY;
    }

    char name[MAX_NAME] = { 0 };
    printf("请输入要删除的联系人姓名: ");
    if (scanf("%19s", name) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    int index = FindByName(pc, name);
    if (index == -1)
    {
        printf("删除失败: 未找到该联系人.\n");
        return CONTACT_ERR_NOT_FOUND;
    }

    for (int i = index; i < pc->sz - 1; i++)
    {
        pc->data[i] = pc->data[i + 1];
    }
    pc->sz--;
    printf("--- 删除联系人成功 ---\n");
    return CONTACT_SUCCESS;
}

// 查找联系人
ContactStatus SearchContact(const Contact* pc)
{
    if (pc == NULL)
    {
        return CONTACT_ERR_NULL_PTR;
    }
    if (pc->sz == 0)
    {
        printf("通讯录为空!\n");
        return CONTACT_ERR_EMPTY;
    }

    char name[MAX_NAME] = { 0 };
    printf("请输入要查找的联系人姓名: ");
    if (scanf("%19s", name) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    int index = FindByName(pc, name);
    if (index == -1)
    {
        printf("未找到该联系人.\n");
        return CONTACT_ERR_NOT_FOUND;
    }

    printf("\n--- 找到联系人信息 ---\n");
    printf("%-20s\t%-5s\t%-10s\t%-15s\t%-30s\n", "姓名", "年龄", "性别", "电话", "地址");
    printf("-------------------------------------------------------------------------\n");
    printf("%-20s\t%-5d\t%-10s\t%-15s\t%-30s\n\n", 
           pc->data[index].name, 
           pc->data[index].age, 
           pc->data[index].sex, 
           pc->data[index].tele, 
           pc->data[index].addr);
    return CONTACT_SUCCESS;
}

// 修改联系人
ContactStatus ModifyContact(Contact* pc)
{
    if (pc == NULL)
    {
        return CONTACT_ERR_NULL_PTR;
    }
    if (pc->sz == 0)
    {
        printf("通讯录为空!\n");
        return CONTACT_ERR_EMPTY;
    }

    char name[MAX_NAME] = { 0 };
    printf("请输入要修改的联系人姓名: ");
    if (scanf("%19s", name) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    int index = FindByName(pc, name);
    if (index == -1)
    {
        printf("未找到该联系人.\n");
        return CONTACT_ERR_NOT_FOUND;
    }

    printf("已找到该联系人, 请输入新信息:\n");
    printf("请输入新名字(最多19个字符): ");
    if (scanf("%19s", pc->data[index].name) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    printf("请输入新年龄: ");
    int res = 0;
    while ((res = scanf("%d", &(pc->data[index].age))) != 1 || pc->data[index].age < 0)
    {
        if (res == EOF || feof(stdin))
        {
            return CONTACT_ERR_EOF;
        }
        printf("输入无效! 请输入合法年龄: ");
        ClearInputBuffer();
    }
    ClearInputBuffer();

    printf("请输入新性别(最多9个字符): ");
    if (scanf("%9s", pc->data[index].sex) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    printf("请输入新电话(最多14个字符): ");
    if (scanf("%14s", pc->data[index].tele) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    printf("请输入新地址(最多29个字符): ");
    if (scanf("%29s", pc->data[index].addr) == EOF || feof(stdin))
    {
        return CONTACT_ERR_EOF;
    }
    ClearInputBuffer();

    printf("--- 修改联系人成功 ---\n");
    return CONTACT_SUCCESS;
}

// 显示所有联系人
ContactStatus ShowContact(const Contact* pc)
{
    if (pc == NULL)
    {
        return CONTACT_ERR_NULL_PTR;
    }
    if (pc->sz == 0)
    {
        printf("当前通讯录为空, 无联系人数据.\n");
        return CONTACT_ERR_EMPTY;
    }

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
    return CONTACT_SUCCESS;
}

// 排序调度 (接收 CompareFunc 回调函数)
ContactStatus SortContact(Contact* pc, CompareFunc compare)
{
    if (pc == NULL || compare == NULL)
    {
        return CONTACT_ERR_NULL_PTR;
    }
    if (pc->sz < 2)
    {
        printf("人数少于2人, 无需排序.\n");
        return CONTACT_SUCCESS;
    }

    qsort(pc->data, pc->sz, sizeof(PeoInfo), compare);
    ShowContact(pc);
    return CONTACT_SUCCESS;
}
