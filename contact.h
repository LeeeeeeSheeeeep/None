#ifndef __CONTACT_H__
#define __CONTACT_H__

#define _CRT_SECURE_NO_WARNINGS 1

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// 常量定义: 定义各个字段的最大长度和通讯录最大容量
#define MAX 100
#define MAX_NAME 20
#define MAX_SEX 10
#define MAX_TELE 15
#define MAX_ADDR 30

// 菜单选项枚举, 增强代码可读性
typedef enum Option
{
    EXIT = 0,
    ADD,
    DEL,
    SEARCH,
    MODIFY,
    SHOW,
    SORT
} Option;

// 联系人信息结构体
typedef struct PeoInfo
{
    char name[MAX_NAME];
    int age;
    char sex[MAX_SEX];
    char tele[MAX_TELE];
    char addr[MAX_ADDR];
} PeoInfo;

// 通讯录结构体
typedef struct Contact
{
    PeoInfo data[MAX]; // 存放数据的数组
    int sz;            // 记录当前已存放的联系人数量
} Contact;

// ====================================================================================
// 函数声明
// ====================================================================================

// 初始化通讯录
void InitContact(Contact* pc);

// 增加联系人
void AddContact(Contact* pc);

// 删除指定联系人
void DelContact(Contact* pc);

// 查找指定联系人并显示信息
void SearchContact(const Contact* pc);

// 修改指定联系人信息
void ModifyContact(Contact* pc);

// 显示所有联系人
void ShowContact(const Contact* pc);

// 排序通讯录 (可按名字排序)
void SortContact(Contact* pc);

#endif // __CONTACT_H__
