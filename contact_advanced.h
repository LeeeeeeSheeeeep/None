#ifndef __CONTACT_ADVANCED_H__
#define __CONTACT_ADVANCED_H__

#define _CRT_SECURE_NO_WARNINGS 1

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
 ====================================================================================
                        [ 高级进阶版 - contact_advanced.h ]
                     面向中高级, 求职面试及工程实践的 C 语言设计
 ====================================================================================
 * 
 * 🛠️ 本设计集成了诸多工业级 C 语言开发的高级技巧:
 *    1. 不透明指针与封装 (Opaque Pointer / ADT)
 *    2. 动态内存管理与按需扩容 (Dynamic Memory Management)
 *    3. 函数指针与策略模式 (Callback Functions for Sorting)
 *    4. 强类型枚举与错误码设计 (Enum State Machine)
 *    5. 内存对齐与性能优化原理 (Memory Alignment & Padding)
 *    6. 健壮的防御性编程 (Defensive Programming & Const-Correctness)
 *
 ====================================================================================
 */

#define MAX_LIMIT 100      // 通讯录硬性容量上限 (最多存放 100 人)
#define INIT_CAPACITY 3    // 通讯录初始动态容量
#define MAX_NAME 20
#define MAX_SEX 10
#define MAX_TELE 15
#define MAX_ADDR 30

// 统一状态/错误码枚举
typedef enum ContactStatus
{
    CONTACT_SUCCESS = 0,      // 操作成功
    CONTACT_ERR_NULL_PTR = -1,// 空指针异常
    CONTACT_ERR_FULL = -2,    // 通讯录已满
    CONTACT_ERR_EMPTY = -3,   // 通讯录为空
    CONTACT_ERR_NOT_FOUND = -4,// 未找到联系人
    CONTACT_ERR_MALLOC = -5,  // 内存分配失败
    CONTACT_ERR_EOF = -6      // 输入流关闭(EOF)
} ContactStatus;

// 菜单选项枚举
typedef enum MenuOption
{
    OPT_EXIT = 0,
    OPT_ADD,
    OPT_DEL,
    OPT_SEARCH,
    OPT_MODIFY,
    OPT_SHOW,
    OPT_SORT
} MenuOption;

// 联系人基础数据结构
typedef struct PeoInfo
{
    char name[MAX_NAME];
    int age;
    char sex[MAX_SEX];
    char tele[MAX_TELE];
    char addr[MAX_ADDR];
} PeoInfo;

// 声明不透明的通讯录句柄 (Opaque Struct)
typedef struct Contact Contact;

// 函数指针定义: 比较回调函数类型
typedef int (*CompareFunc)(const void*, const void*);

// 接口函数声明
Contact* CreateContact(ContactStatus* pStatus);
void DestroyContact(Contact* pc);
ContactStatus AddContact(Contact* pc);
ContactStatus DelContact(Contact* pc);
ContactStatus SearchContact(const Contact* pc);
ContactStatus ModifyContact(Contact* pc);
ContactStatus ShowContact(const Contact* pc);
ContactStatus SortContact(Contact* pc, CompareFunc compare);
void ClearInputBuffer(void);

#endif // __CONTACT_ADVANCED_H__
